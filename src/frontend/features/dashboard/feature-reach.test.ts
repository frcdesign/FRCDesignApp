import { describe, expect, it } from "vitest";
import type { FeatureReachOut } from "@backend/features/analytics/contract";
import { AppFeature } from "@backend/features/analytics/usage";
import {
    evenTicks,
    featureOrder,
    latestPoint,
    nudgeMarks,
    ReachMeasure,
    toReachSeries
} from "./feature-reach";
import { NUDGES, NudgeChange, NudgeKind } from "./nudges";

// 2026-10-26 is a Monday.
const REACH: FeatureReachOut = {
    weeks: [
        { week: "2026-10-19", activeUsers: 10, users: {} },
        {
            week: "2026-10-26",
            activeUsers: 8,
            users: { [AppFeature.INSERT_LOCATION]: 2 }
        },
        { week: "2026-11-02", activeUsers: 0, users: {} },
        {
            week: "2026-11-09",
            activeUsers: 5,
            users: { [AppFeature.SEARCH]: 5 }
        }
    ],
    firstUsed: {
        [AppFeature.INSERT_LOCATION]: "2026-10-30",
        [AppFeature.SEARCH]: "2026-01-04"
    }
};

describe("toReachSeries", () => {
    it("starts a feature's line the week its record does", () => {
        const reach = toReachSeries(REACH, AppFeature.INSERT_LOCATION).map(
            (point) => point.value
        );

        expect(reach).toEqual([null, 25, null, 0]);
    });

    it("leaves a week with nobody about blank rather than at zero", () => {
        const points = toReachSeries(
            REACH,
            AppFeature.SEARCH,
            ReachMeasure.SHARE
        );

        expect(points.map((point) => point.value)).toEqual([0, 0, null, 100]);
        expect(latestPoint(points)).toMatchObject({
            bucket: "2026-11-09",
            users: 5,
            activeUsers: 5
        });
    });

    it("draws nothing for a feature nobody has used", () => {
        const points = toReachSeries(REACH, AppFeature.FASTEN);

        expect(latestPoint(points)).toBeUndefined();
    });
});

describe("toReachSeries, new and existing users", () => {
    const split: FeatureReachOut = {
        weeks: [
            // Too near when tracking began to tell new users apart.
            { week: "2026-10-26", activeUsers: 6, users: {} },
            {
                week: "2026-11-02",
                activeUsers: 10,
                users: { [AppFeature.SEARCH]: 6 },
                newActiveUsers: 4,
                newUsers: { [AppFeature.SEARCH]: 1 }
            },
            {
                week: "2026-11-09",
                activeUsers: 5,
                users: { [AppFeature.SEARCH]: 5 },
                newActiveUsers: 0,
                newUsers: {}
            }
        ],
        firstUsed: { [AppFeature.SEARCH]: "2026-01-04" }
    };

    it("takes the new users out of everybody's to leave the existing", () => {
        const [, week] = toReachSeries(
            split,
            AppFeature.SEARCH,
            ReachMeasure.SHARE
        );

        expect(week).toMatchObject({
            value: 60,
            newValue: 25,
            existingValue: (5 / 6) * 100,
            newCount: { users: 1, activeUsers: 4 },
            existingCount: { users: 5, activeUsers: 6 }
        });
    });

    it("leaves a group blank where it can't be told apart or had nobody about", () => {
        const points = toReachSeries(
            split,
            AppFeature.SEARCH,
            ReachMeasure.SHARE
        );

        expect(points.map((point) => point.newValue)).toEqual([null, 25, null]);
        expect(points.map((point) => point.existingValue)).toEqual([
            null,
            (5 / 6) * 100,
            100
        ]);
        expect(points[0].value).toBe(0);
    });
});

describe("toReachSeries, counted", () => {
    it("counts the week's users, a quiet week at zero", () => {
        const points = toReachSeries(
            REACH,
            AppFeature.SEARCH,
            ReachMeasure.USERS
        );

        expect(points.map((point) => point.value)).toEqual([0, 0, 0, 5]);
    });

    it("still starts the line at the feature's first recorded use", () => {
        const points = toReachSeries(
            REACH,
            AppFeature.INSERT_LOCATION,
            ReachMeasure.USERS
        );

        expect(points.map((point) => point.value)).toEqual([null, 2, 0, 0]);
    });
});

describe("nudgeMarks", () => {
    const dot = {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-10-29"
    };
    const tip = { ...dot, kind: NudgeKind.TIP, day: "2026-10-31" };
    const points = toReachSeries(REACH, AppFeature.VERSION_MANAGER);

    it("marks a nudge on the week it shipped in, joining a week's nudges", () => {
        expect(
            nudgeMarks(AppFeature.VERSION_MANAGER, points, [dot, tip])
        ).toEqual([{ bucket: "2026-10-26", label: "Blue dot · Tip" }]);
    });

    it("marks only the feature's own nudges, inside the range", () => {
        const outside = { ...dot, day: "2026-12-01" };

        expect(nudgeMarks(AppFeature.SEARCH, points, [dot])).toEqual([]);
        expect(
            nudgeMarks(AppFeature.VERSION_MANAGER, points, [outside])
        ).toEqual([]);
    });
});

describe("evenTicks", () => {
    const weeks = Array.from({ length: 13 }, (_, i) => `w${i}`);

    it("labels every week that fits", () => {
        expect(evenTicks(weeks.slice(0, 4), 5)).toEqual(weeks.slice(0, 4));
    });

    it("spaces the labels evenly back from the newest week", () => {
        expect(evenTicks(weeks, 5)).toEqual(["w0", "w3", "w6", "w9", "w12"]);
        expect(evenTicks(weeks.slice(0, 12), 5)).toEqual([
            "w2",
            "w5",
            "w8",
            "w11"
        ]);
    });
});

describe("featureOrder", () => {
    it("lists every feature once, the nudged ones first", () => {
        const order = featureOrder();

        expect([...order].sort()).toEqual(Object.values(AppFeature).sort());
        expect(order[0]).toBe(NUDGES[0].feature);
    });
});

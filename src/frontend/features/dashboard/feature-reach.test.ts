import { describe, expect, it } from "vitest";
import {
    ReachInterval,
    type FeatureReachOut
} from "@backend/features/analytics/contract";
import { AppFeature } from "@backend/features/analytics/usage";
import {
    evenTicks,
    featureOrder,
    featureMarks,
    latestPoint,
    reachMeasure,
    ReachMeasure,
    toReachSeries
} from "./feature-reach";
import {
    NUDGES,
    NudgeChange,
    NudgeKind,
    NudgeName,
    ReleaseName,
    type Nudge,
    type Release
} from "./nudges";

// 2026-10-26 is a Monday.
const REACH: FeatureReachOut = {
    interval: ReachInterval.WEEK,
    buckets: [
        { start: "2026-10-19", activeUsers: 10, users: {}, times: {} },
        {
            start: "2026-10-26",
            activeUsers: 8,
            users: { [AppFeature.INSERT_LOCATION]: 2 },
            times: {}
        },
        { start: "2026-11-02", activeUsers: 0, users: {}, times: {} },
        {
            start: "2026-11-09",
            activeUsers: 5,
            users: { [AppFeature.SEARCH]: 5 },
            times: {}
        }
    ],
    timesSince: {},
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
        interval: ReachInterval.WEEK,
        buckets: [
            // Too near when tracking began to tell new users apart.
            { start: "2026-10-26", activeUsers: 6, users: {}, times: {} },
            {
                start: "2026-11-02",
                activeUsers: 10,
                users: { [AppFeature.SEARCH]: 6 },
                times: {},
                newActiveUsers: 4,
                newUsers: { [AppFeature.SEARCH]: 1 }
            },
            {
                start: "2026-11-09",
                activeUsers: 5,
                users: { [AppFeature.SEARCH]: 5 },
                times: {},
                newActiveUsers: 0,
                newUsers: {}
            }
        ],
        timesSince: {},
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

describe("toReachSeries, a point a day", () => {
    const daily: FeatureReachOut = {
        interval: ReachInterval.DAY,
        buckets: [
            { start: "2026-10-29", activeUsers: 4, users: {}, times: {} },
            {
                start: "2026-10-30",
                activeUsers: 4,
                users: { [AppFeature.INSERT_LOCATION]: 1 },
                times: {}
            }
        ],
        timesSince: {},
        firstUsed: { [AppFeature.INSERT_LOCATION]: "2026-10-30" }
    };

    it("starts a feature's line the day its record does, labelled by day", () => {
        const points = toReachSeries(daily, AppFeature.INSERT_LOCATION);

        expect(points.map((point) => point.value)).toEqual([null, 25]);
        expect(points[1].label).not.toBe(points[0].label);
    });

    it("marks a nudge on the day it shipped", () => {
        const points = toReachSeries(daily, AppFeature.INSERT_LOCATION);
        const nudge = {
            feature: AppFeature.INSERT_LOCATION,
            kind: NudgeKind.DOT,
            change: NudgeChange.ADDED,
            day: "2026-10-30"
        };

        expect(
            featureMarks(
                AppFeature.INSERT_LOCATION,
                points,
                ReachInterval.DAY,
                [],
                [nudge]
            )
        ).toEqual([{ bucket: "2026-10-30", label: "Blue dot" }]);
    });
});

describe("toReachSeries, times", () => {
    // Counted from Wednesday 2026-10-28, so from the week after.
    const counted: FeatureReachOut = {
        interval: ReachInterval.WEEK,
        buckets: [
            {
                start: "2026-10-26",
                activeUsers: 10,
                users: { [AppFeature.SEARCH]: 9 },
                times: { [AppFeature.SEARCH]: 4 }
            },
            {
                start: "2026-11-02",
                activeUsers: 10,
                users: { [AppFeature.SEARCH]: 9 },
                times: { [AppFeature.SEARCH]: 30 },
                newActiveUsers: 2,
                newUsers: { [AppFeature.SEARCH]: 2 },
                newTimes: { [AppFeature.SEARCH]: 5 }
            },
            {
                start: "2026-11-09",
                activeUsers: 10,
                users: {},
                times: {},
                newActiveUsers: 0,
                newUsers: {},
                newTimes: {}
            }
        ],
        firstUsed: { [AppFeature.SEARCH]: "2026-01-04" },
        timesSince: { [AppFeature.SEARCH]: "2026-10-28" }
    };

    it("starts at the first whole week counted, a quiet week at zero", () => {
        const points = toReachSeries(
            counted,
            AppFeature.SEARCH,
            ReachMeasure.TIMES
        );

        expect(points.map((point) => point.value)).toEqual([null, 30, 0]);
        expect(points[1]).toMatchObject({ newValue: 5, existingValue: 25 });
    });

    it("counts every report in one line", () => {
        const reports: FeatureReachOut = {
            interval: ReachInterval.WEEK,
            buckets: [
                {
                    start: "2026-11-02",
                    activeUsers: 10,
                    users: { [AppFeature.REPORT]: 1 },
                    times: { [AppFeature.REPORT]: 3 },
                    newActiveUsers: 2,
                    newUsers: {},
                    newTimes: {}
                }
            ],
            firstUsed: { [AppFeature.REPORT]: "2026-01-04" },
            timesSince: {}
        };

        const [week] = toReachSeries(reports, AppFeature.REPORT);

        expect(week).toMatchObject({
            value: 3,
            newValue: null,
            existingValue: null
        });
    });
});

describe("featureMarks", () => {
    const dot: Nudge = {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-10-29"
    };
    const tip = { ...dot, kind: NudgeKind.TIP, day: "2026-10-31" };
    const points = toReachSeries(REACH, AppFeature.VERSION_MANAGER);
    const marks = (
        nudges: Nudge[],
        releases: Release[] = [],
        feature = AppFeature.VERSION_MANAGER
    ) => featureMarks(feature, points, ReachInterval.WEEK, releases, nudges);

    it("marks a nudge on the week it shipped in, joining a week's nudges", () => {
        expect(marks([dot, tip])).toEqual([
            { bucket: "2026-10-26", label: "Blue dot · Tip" }
        ]);
    });

    it("labels a named nudge by its name", () => {
        const links = {
            ...dot,
            kind: NudgeKind.SUGGESTION,
            name: NudgeName.SUGGESTED_LINKS
        };
        const withdrawn = { ...links, change: NudgeChange.REMOVED };

        expect(marks([links])).toEqual([
            { bucket: "2026-10-26", label: "Suggested links" }
        ]);
        expect(marks([withdrawn])).toEqual([
            { bucket: "2026-10-26", label: "Suggested links removed" }
        ]);
    });

    it("leaves a nudge unmarked until it has shipped", () => {
        const unshipped = { ...dot, day: undefined };

        expect(marks([unshipped])).toEqual([]);
    });

    it("names a release alone where a nudge changed with it", () => {
        const created = { feature: AppFeature.VERSION_MANAGER, day: dot.day! };

        expect(marks([dot, tip], [created])).toEqual([
            { bucket: "2026-10-26", label: "Created · Tip" }
        ]);
    });

    it("labels a new way to reach a feature by its name", () => {
        const menu = {
            feature: AppFeature.VERSION_MANAGER,
            name: ReleaseName.CONTEXT_MENU,
            day: "2026-10-30"
        };

        const withdrawn = {
            ...tip,
            change: NudgeChange.REMOVED,
            day: menu.day
        };

        expect(marks([dot, withdrawn], [menu])).toEqual([
            { bucket: "2026-10-26", label: "Context menu · Blue dot" }
        ]);
    });

    it("marks only the feature's own nudges, inside the range", () => {
        const outside = { ...dot, day: "2026-12-01" };

        expect(marks([dot], [], AppFeature.SEARCH)).toEqual([]);
        expect(marks([outside])).toEqual([]);
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
    it("lists every charted feature once, the nudged ones first", () => {
        const order = featureOrder();

        expect([...order].sort()).toEqual(
            Object.values(AppFeature)
                .filter(
                    (feature) => feature !== AppFeature.DEFAULT_CONFIGURATION
                )
                .sort()
        );
        expect(order[0]).toBe(NUDGES[0].feature);
    });
});

describe("reachMeasure", () => {
    const reach = (
        users: number,
        activeUsers = 100,
        timesSince?: string
    ): FeatureReachOut => ({
        interval: ReachInterval.WEEK,
        buckets: [
            // Before the feature's record starts, so left out.
            { start: "2026-10-19", activeUsers: 1000, users: {}, times: {} },
            {
                start: "2026-10-26",
                activeUsers,
                users: { [AppFeature.FASTEN]: users },
                times: { [AppFeature.FASTEN]: users * 3 }
            }
        ],
        firstUsed: { [AppFeature.FASTEN]: "2026-10-26" },
        timesSince: timesSince ? { [AppFeature.FASTEN]: timesSince } : {}
    });

    it("shares a feature however few use it", () => {
        expect(reachMeasure(reach(2), AppFeature.FASTEN)).toBe(
            ReachMeasure.SHARE
        );
        expect(reachMeasure(reach(84), AppFeature.FASTEN)).toBe(
            ReachMeasure.SHARE
        );
    });

    it("counts the times a feature nearly all use is used", () => {
        expect(reachMeasure(reach(85), AppFeature.FASTEN)).toBe(
            ReachMeasure.TIMES
        );
    });

    it("shares it while part of the range is uncounted", () => {
        expect(
            reachMeasure(reach(97, 100, "2026-10-27"), AppFeature.FASTEN)
        ).toBe(ReachMeasure.SHARE);
        expect(
            reachMeasure(reach(97, 100, "2026-10-26"), AppFeature.FASTEN)
        ).toBe(ReachMeasure.TIMES);
    });

    it("counts reports", () => {
        expect(reachMeasure(reach(40), AppFeature.REPORT)).toBe(
            ReachMeasure.TIMES
        );
    });

    it("shares a feature with nothing recorded", () => {
        expect(reachMeasure(REACH, AppFeature.FASTEN)).toBe(ReachMeasure.SHARE);
        expect(reachMeasure(reach(0, 0), AppFeature.FASTEN)).toBe(
            ReachMeasure.SHARE
        );
    });
});

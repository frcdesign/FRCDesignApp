import { and, countDistinct, eq, gte, lte, sql, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { dailyMetrics, dailyUserActivity } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import { EventType } from "./events";
import {
    baselineWindow,
    LIBRARY_PROGRAM,
    Program,
    seasonWindow
} from "./seasons";
import {
    type GrowthMeasure,
    type GrowthOut,
    type PeriodComparison
} from "./contract";
import { RECENT_DAYS } from "./measures";

interface Window {
    from: string;
    to: string;
}

function addDays(day: string, count: number): string {
    const at = Date.parse(`${day}T00:00:00Z`) + count * 24 * 3600 * 1000;
    return new Date(at).toISOString().slice(0, 10);
}

/**
 * The two trailing windows to compare, ending yesterday: a part-finished today
 * would manufacture a decline every morning that recovers by evening.
 */
export function recentWindows(today: string): {
    current: Window;
    previous: Window;
} {
    const to = addDays(today, -1);
    const from = addDays(to, -(RECENT_DAYS - 1));
    return {
        current: { from, to },
        previous: {
            from: addDays(from, -RECENT_DAYS),
            to: addDays(from, -1)
        }
    };
}

/**
 * Withholds the percentage when the baseline reaches back past the day tracking
 * started: that window is empty for want of recording, not of activity.
 */
export function toComparison(
    current: number,
    previous: number,
    windows: { current: Window; previous: Window },
    labels: Pick<PeriodComparison, "label" | "baselineLabel" | "baselineShort">,
    trackingSince: string | null
): PeriodComparison {
    const base = {
        current,
        previous,
        currentFrom: windows.current.from,
        currentTo: windows.current.to,
        previousFrom: windows.previous.from,
        previousTo: windows.previous.to,
        ...labels
    };

    if (trackingSince === null || windows.previous.to < trackingSince) {
        return { ...base, changeRatio: null, unavailable: "no-prior-data" };
    }
    if (windows.previous.from < trackingSince) {
        return {
            ...base,
            changeRatio: null,
            unavailable: "partial-prior-data"
        };
    }
    if (previous === 0) {
        // Both empty is a quiet stretch, not a gap in what was recorded — the
        // difference decides whether the UI blames tracking or the period.
        return {
            ...base,
            changeRatio: null,
            unavailable: current === 0 ? "no-activity" : "zero-baseline"
        };
    }
    return { ...base, changeRatio: (current - previous) / previous };
}

/** One event type over two windows, as a single range scan over the rollup. */
async function countEvents(
    db: Db,
    windows: { current: Window; previous: Window },
    type: EventType,
    libraryId?: LibraryId
): Promise<{ current: number; previous: number }> {
    const filters = [
        eq(dailyMetrics.type, type),
        gte(dailyMetrics.day, windows.previous.from),
        lte(dailyMetrics.day, windows.current.to)
    ];
    if (libraryId) filters.push(eq(dailyMetrics.libraryId, libraryId));

    const row = await db
        .select({
            current: sum(
                sql`CASE WHEN ${dailyMetrics.day} >= ${windows.current.from} THEN ${dailyMetrics.count} ELSE 0 END`
            ),
            previous: sum(
                sql`CASE WHEN ${dailyMetrics.day} <= ${windows.previous.to} THEN ${dailyMetrics.count} ELSE 0 END`
            )
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .get();

    return {
        current: Number(row?.current ?? 0),
        previous: Number(row?.previous ?? 0)
    };
}

/**
 * Two queries rather than one: a COUNT(DISTINCT) cannot be split by a CASE, and
 * someone active in both windows counts once in each.
 */
async function countPeople(
    db: Db,
    windows: { current: Window; previous: Window },
    libraryId?: LibraryId
): Promise<{ current: number; previous: number }> {
    const inWindow = (window: Window) => {
        const filters = [
            gte(dailyUserActivity.day, window.from),
            lte(dailyUserActivity.day, window.to)
        ];
        if (libraryId) {
            filters.push(eq(dailyUserActivity.libraryId, libraryId));
        }
        return db
            .select({ value: countDistinct(dailyUserActivity.userId) })
            .from(dailyUserActivity)
            .where(and(...filters))
            .get();
    };

    const [current, previous] = await Promise.all([
        inWindow(windows.current),
        inWindow(windows.previous)
    ]);
    return { current: current?.value ?? 0, previous: previous?.value ?? 0 };
}

/**
 * Measures one window pair three ways, so a set of comparisons is built from a
 * single description of what to compare.
 */
async function measure(
    db: Db,
    windows: { current: Window; previous: Window },
    labels: Pick<PeriodComparison, "label" | "baselineLabel" | "baselineShort">,
    trackingSince: string | null,
    libraryId?: LibraryId
): Promise<Record<GrowthMeasure, PeriodComparison>> {
    const [inserts, people, opens] = await Promise.all([
        countEvents(db, windows, EventType.INSERT, libraryId),
        countPeople(db, windows, libraryId),
        countEvents(db, windows, EventType.APP_OPEN, libraryId)
    ]);

    const compare = (counts: { current: number; previous: number }) =>
        toComparison(
            counts.current,
            counts.previous,
            windows,
            labels,
            trackingSince
        );

    return {
        inserts: compare(inserts),
        activeUsers: compare(people),
        appOpens: compare(opens)
    };
}

/**
 * Growth for a library, or for the app when no library is given. The app spans
 * Sept–Apr, which covers FRC's Jan–Apr, so its season is named without a program.
 */
export async function getGrowth(
    db: Db,
    today: string,
    trackingSince: string | null,
    libraryId?: LibraryId
): Promise<GrowthOut> {
    const windows = recentWindows(today);
    const recentLabels = {
        label: `Last ${RECENT_DAYS} days`,
        baselineLabel: `the ${RECENT_DAYS} days before`,
        baselineShort: `${RECENT_DAYS} days`
    };

    const program = libraryId ? LIBRARY_PROGRAM[libraryId] : Program.FTC;
    const season = seasonWindow(program, today);
    const baseline = baselineWindow(season);
    const seasonWindows = {
        current: { from: season.from, to: season.to },
        previous: { from: baseline.from, to: baseline.to }
    };
    const name = (of: { label: string; years: string }) =>
        libraryId ? of.label : `${of.years} season`;
    const seasonLabels = {
        label: season.inProgress
            ? `${name(season.season)} so far`
            : name(season.season),
        baselineLabel: season.inProgress
            ? `${name(baseline.season)} at the same point`
            : name(baseline.season),
        baselineShort: "last season"
    };

    const [recent, seasonal] = await Promise.all([
        measure(db, windows, recentLabels, trackingSince, libraryId),
        measure(db, seasonWindows, seasonLabels, trackingSince, libraryId)
    ]);

    return { recent, season: seasonal, trackingSince };
}

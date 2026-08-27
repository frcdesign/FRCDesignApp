import { and, countDistinct, eq, gte, lte, sql, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { dailyMetrics, dailyUserActivity } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import { EventType } from "./events";
import {
    baselineWindow,
    LIBRARY_PROGRAM,
    previousSeason,
    Program,
    seasonWindow,
    type SeasonWindow
} from "./seasons";
import type {
    GrowthOut,
    PeriodComparison,
    SeasonCurveOut,
    SeasonCurvePoint
} from "./contract";

/**
 * Trailing window length. 28 rather than 30 so it is whole weeks: a 30-day
 * window contains four of some weekdays and five of others, and the ratio
 * between two of them wobbles with the calendar rather than with usage.
 */
export const RECENT_DAYS = 28;

interface Window {
    from: string;
    to: string;
}

function addDays(day: string, count: number): string {
    const at = Date.parse(`${day}T00:00:00Z`) + count * 24 * 3600 * 1000;
    return new Date(at).toISOString().slice(0, 10);
}

/**
 * The two trailing windows to compare, ending yesterday.
 *
 * Today is deliberately excluded: a part-finished day always reads lower than
 * a whole one, so including it manufactures a decline every morning that
 * recovers by evening.
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
 * Builds the comparison, deciding whether a change can honestly be stated.
 *
 * A percentage is withheld rather than faked whenever the baseline window
 * reaches back past the day tracking started — that window is empty because
 * nothing was recorded, not because nothing happened.
 */
export function toComparison(
    current: number,
    previous: number,
    windows: { current: Window; previous: Window },
    labels: { label: string; baselineLabel: string },
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
 * Distinct people over two windows.
 *
 * Two queries rather than one: a COUNT(DISTINCT) cannot be split by a CASE the
 * way a SUM can, because the same person appearing in both windows must count
 * once in each and not once overall.
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

/** Daily inserts inside one window, oldest first. */
async function insertsByDay(
    db: Db,
    window: Window,
    libraryId?: LibraryId
): Promise<{ day: string; count: number }[]> {
    const filters = [
        eq(dailyMetrics.type, EventType.INSERT),
        gte(dailyMetrics.day, window.from),
        lte(dailyMetrics.day, window.to)
    ];
    if (libraryId) filters.push(eq(dailyMetrics.libraryId, libraryId));

    return db
        .select({
            day: dailyMetrics.day,
            count: sum(dailyMetrics.count).mapWith(Number)
        })
        .from(dailyMetrics)
        .where(and(...filters))
        .groupBy(dailyMetrics.day)
        .orderBy(dailyMetrics.day)
        .all();
}

/** Whole weeks between a season opening and a day in it. */
function weekIndex(seasonFrom: string, day: string): number {
    const ms =
        Date.parse(`${day}T00:00:00Z`) - Date.parse(`${seasonFrom}T00:00:00Z`);
    return Math.floor(ms / (7 * 24 * 3600 * 1000));
}

/** Running totals by week, so week n holds everything up to the end of it. */
function toCumulative(
    rows: { day: string; count: number }[],
    seasonFrom: string,
    weeks: number
): number[] {
    const perWeek = new Array<number>(weeks).fill(0);
    for (const row of rows) {
        const index = weekIndex(seasonFrom, row.day);
        if (index >= 0 && index < weeks) perWeek[index] += row.count;
    }
    let running = 0;
    return perWeek.map((count) => (running += count));
}

/**
 * Both seasons' cumulative curves on one axis of weeks since kickoff.
 *
 * Weeks rather than dates, because the two seasons open on different days —
 * and for FTC in different calendar years — so no date axis can hold both.
 * Last season is drawn in full while this one stops where it has got to, which
 * is the whole point: the gap between the two lines is the year-over-year
 * change, read off at a glance instead of from a percentage.
 */
async function getSeasonCurve(
    db: Db,
    window: SeasonWindow,
    libraryId?: LibraryId
): Promise<SeasonCurveOut> {
    const previous = previousSeason(window.season);
    const weeks =
        Math.max(
            weekIndex(window.season.from, window.season.to),
            weekIndex(previous.from, previous.to)
        ) + 1;
    // Whole weeks only: a part-finished week always falls below the line and
    // reads as a slowdown that has not happened.
    const reached = window.inProgress
        ? weekIndex(window.season.from, window.to)
        : weeks;

    const [currentRows, previousRows] = await Promise.all([
        insertsByDay(
            db,
            { from: window.season.from, to: window.to },
            libraryId
        ),
        insertsByDay(db, { from: previous.from, to: previous.to }, libraryId)
    ]);

    const current = toCumulative(currentRows, window.season.from, weeks);
    const priorTotals = toCumulative(previousRows, previous.from, weeks);

    const points: SeasonCurvePoint[] = [];
    for (let week = 0; week < weeks; week++) {
        points.push({
            week,
            current: week < reached ? current[week] : null,
            previous: priorTotals[week]
        });
    }
    return {
        points,
        label: window.season.label,
        baselineLabel: previous.label
    };
}

/**
 * Growth for a library, or for the app when no library is given.
 *
 * The app spans both competitions, so its season comparison uses FRC — the
 * program two of the three libraries serve, and the one whose Jan–Apr window
 * sits inside FTC's.
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
        baselineLabel: `the ${RECENT_DAYS} days before`
    };

    const program = libraryId ? LIBRARY_PROGRAM[libraryId] : Program.FRC;
    const season = seasonWindow(program, today);
    const baseline = baselineWindow(season);
    const seasonWindows = {
        current: { from: season.from, to: season.to },
        previous: { from: baseline.from, to: baseline.to }
    };

    const [inserts, people, opens, seasonInserts, seasonCurve] =
        await Promise.all([
            countEvents(db, windows, EventType.INSERT, libraryId),
            countPeople(db, windows, libraryId),
            countEvents(db, windows, EventType.APP_OPEN, libraryId),
            countEvents(db, seasonWindows, EventType.INSERT, libraryId),
            getSeasonCurve(db, season, libraryId)
        ]);

    return {
        recent: {
            inserts: toComparison(
                inserts.current,
                inserts.previous,
                windows,
                recentLabels,
                trackingSince
            ),
            activeUsers: toComparison(
                people.current,
                people.previous,
                windows,
                recentLabels,
                trackingSince
            ),
            appOpens: toComparison(
                opens.current,
                opens.previous,
                windows,
                recentLabels,
                trackingSince
            )
        },
        season: toComparison(
            seasonInserts.current,
            seasonInserts.previous,
            seasonWindows,
            {
                label: season.inProgress
                    ? `${season.season.label} so far`
                    : season.season.label,
                baselineLabel: season.inProgress
                    ? `${baseline.season.label} at the same point`
                    : baseline.season.label
            },
            trackingSince
        ),
        seasonCurve,
        trackingSince
    };
}

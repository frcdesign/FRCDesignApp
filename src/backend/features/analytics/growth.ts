import { and, countDistinct, eq, gte, lte, sql, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { dailyAppOpens, dailyMetrics } from "./schema";
import { LibraryId } from "../library/library-id";
import { EventType } from "./usage";
import {
    baselineWindow,
    LIBRARY_PROGRAM,
    Program,
    seasonWindow
} from "./seasons";
import {
    ChangeUnavailable,
    type GrowthOut,
    type PeriodComparison
} from "./contract";
import { activeUserRows } from "./metric-queries";

/** Both bounds inclusive, as every day key in this file is. */
interface Window {
    from: string;
    to: string;
}

/** A window and the earlier one it is measured against. */
interface Windows {
    current: Window;
    previous: Window;
}

/** One measure over both. */
interface Counts {
    current: number;
    previous: number;
}

/** Withheld when the baseline predates tracking, since it's empty for want of data. */
export function toComparison(
    current: number,
    previous: number,
    windows: Windows,
    labels: Pick<PeriodComparison, "label" | "baselineLabel" | "baselineShort">,
    trackingSince: string | undefined
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

    if (trackingSince === undefined || windows.previous.to < trackingSince) {
        return {
            ...base,
            unavailable: ChangeUnavailable.NO_PRIOR_DATA
        };
    }
    if (windows.previous.from < trackingSince) {
        return { ...base, unavailable: ChangeUnavailable.PARTIAL_PRIOR_DATA };
    }
    if (previous === 0) {
        // Lets the UI tell a quiet stretch from missing data.
        return {
            ...base,
            unavailable:
                current === 0
                    ? ChangeUnavailable.NO_ACTIVITY
                    : ChangeUnavailable.ZERO_BASELINE
        };
    }
    return { ...base, changeRatio: (current - previous) / previous };
}

/** One event type over two windows, as a single range scan over the rollup. */
async function countEvents(
    db: Db,
    windows: Windows,
    type: EventType,
    libraryId?: LibraryId
): Promise<Counts> {
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

/** Two queries: COUNT(DISTINCT) can't be split by a CASE. */
async function countPeople(
    db: Db,
    windows: Windows,
    libraryId?: LibraryId
): Promise<Counts> {
    const inWindow = (window: Window) => {
        const active = activeUserRows(db, window, libraryId);
        return db
            .select({ value: countDistinct(active.userId) })
            .from(active)
            .get();
    };

    const [current, previous] = await Promise.all([
        inWindow(windows.current),
        inWindow(windows.previous)
    ]);
    return { current: current?.value ?? 0, previous: previous?.value ?? 0 };
}

/** App-wide, so there is no library to scope it to; see `daily_app_opens`. */
async function countOpens(db: Db, windows: Windows): Promise<Counts> {
    const row = await db
        .select({
            current: sum(
                sql`CASE WHEN ${dailyAppOpens.day} >= ${windows.current.from} THEN ${dailyAppOpens.opens} ELSE 0 END`
            ),
            previous: sum(
                sql`CASE WHEN ${dailyAppOpens.day} <= ${windows.previous.to} THEN ${dailyAppOpens.opens} ELSE 0 END`
            )
        })
        .from(dailyAppOpens)
        .where(
            and(
                gte(dailyAppOpens.day, windows.previous.from),
                lte(dailyAppOpens.day, windows.current.to)
            )
        )
        .get();

    return {
        current: Number(row?.current ?? 0),
        previous: Number(row?.previous ?? 0)
    };
}

async function measure(
    db: Db,
    windows: Windows,
    labels: Pick<PeriodComparison, "label" | "baselineLabel" | "baselineShort">,
    trackingSince: string | undefined,
    libraryId?: LibraryId
): Promise<GrowthOut> {
    const [inserts, people, opens] = await Promise.all([
        countEvents(db, windows, EventType.INSERT, libraryId),
        countPeople(db, windows, libraryId),
        libraryId ? undefined : countOpens(db, windows)
    ]);

    const compare = (counts: Counts) =>
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
        appOpens: opens && compare(opens)
    };
}

/**
 * For the app when no library is given. The app's season spans Sept–Apr, which
 * covers FRC's Jan–Apr, so it's named without a program.
 */
export async function getGrowth(
    db: Db,
    through: string,
    trackingSince: string | undefined,
    libraryId?: LibraryId
): Promise<GrowthOut> {
    const program = libraryId ? LIBRARY_PROGRAM[libraryId] : Program.FTC;
    const season = seasonWindow(program, through);
    const baseline = baselineWindow(season);
    const windows = {
        current: { from: season.from, to: season.to },
        previous: { from: baseline.from, to: baseline.to }
    };
    const name = (of: { label: string; years: string }) =>
        libraryId ? of.label : `${of.years} season`;
    const labels = {
        label: season.inProgress
            ? `${name(season.season)} so far`
            : name(season.season),
        baselineLabel: season.inProgress
            ? `${name(baseline.season)} at the same point`
            : name(baseline.season),
        baselineShort: "last season"
    };

    return measure(db, windows, labels, trackingSince, libraryId);
}

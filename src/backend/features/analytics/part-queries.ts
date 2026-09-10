/**
 * Reads of the per-part rollups: what a part was used for inside a window, and
 * how that lands day by day.
 */
import { and, count, countDistinct, eq, gte, lte, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations, favorites, insertables } from "../../db/schema";
import {
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    insertableStats
} from "./schema";
import { LibraryId } from "../library/library-id";
import { type PartUsageOut } from "./contract";
import { MONTH_DAYS, usesPerMonth } from "./measures";
import { addDays, toDayKey, type DayRange } from "./day";
import { toElementPath } from "../../lib/onshape/path";
import { type ConfigurationParameter } from "../configurations/models";

export interface PartRow {
    elementId: string;
    name: string;
    groupName: string;
    documentId: string;
    versionId: string;
    isVisible: boolean;
    firstInsertedAt: Date | null;
}

/** One part counted over the window rather than over its whole history. */
export function toWindowedPart(
    row: PartRow,
    windowed: Map<string, number>,
    series: Map<string, number[]>,
    range: DayRange
): PartUsageOut {
    const from = Date.parse(`${range.from}T00:00:00Z`);
    const to = Math.min(Date.now(), Date.parse(`${range.to}T23:59:59Z`));
    const insertCount = windowed.get(row.elementId) ?? 0;
    // Rated over the days the part has existed, so arriving late in the window
    // does not read as unpopular.
    const firstUsed = Math.max(row.firstInsertedAt?.getTime() ?? from, from);

    return {
        path: toElementPath(row),
        name: row.name,
        groupName: row.groupName,
        isVisible: row.isVisible,
        insertCount,
        usesPerMonth: usesPerMonth(
            insertCount,
            insertCount === 0 ? undefined : firstUsed,
            to
        ),
        recent: series.get(row.elementId) ?? emptySparkline()
    };
}

/**
 * Inserts per element inside the window, folded out of the daily rollup —
 * a range scan, thanks to `daily_insertable_metrics_day_idx`.
 */
export async function getWindowedInsertCounts(
    db: Db,
    libraryId: LibraryId,
    range: DayRange
): Promise<Map<string, number>> {
    const rows = await db
        .select({
            elementId: dailyInsertableMetrics.elementId,
            count: sum(dailyInsertableMetrics.count)
        })
        .from(dailyInsertableMetrics)
        .where(inWindow(libraryId, range))
        .groupBy(dailyInsertableMetrics.elementId)
        .all();

    return new Map(rows.map((row) => [row.elementId, Number(row.count ?? 0)]));
}

/** The day-range filter every per-part rollup read shares. */
export function inWindow(libraryId: LibraryId, range: DayRange) {
    return and(
        eq(dailyInsertableMetrics.libraryId, libraryId),
        gte(dailyInsertableMetrics.day, range.from),
        lte(dailyInsertableMetrics.day, range.to)
    );
}

interface ConfigurationCount {
    elementId: string;
    parameterId: string;
    value: string;
    count: number;
}

/** How often each configuration value was chosen inside the window. */
export async function getConfigurationCounts(
    db: Db,
    libraryId: LibraryId,
    range: DayRange,
    elementId?: string
): Promise<ConfigurationCount[]> {
    const rows = await db
        .select({
            elementId: dailyConfigurationMetrics.elementId,
            parameterId: dailyConfigurationMetrics.parameterId,
            value: dailyConfigurationMetrics.value,
            count: sum(dailyConfigurationMetrics.count)
        })
        .from(dailyConfigurationMetrics)
        .where(
            and(
                eq(dailyConfigurationMetrics.libraryId, libraryId),
                gte(dailyConfigurationMetrics.day, range.from),
                lte(dailyConfigurationMetrics.day, range.to),
                elementId === undefined
                    ? undefined
                    : eq(dailyConfigurationMetrics.elementId, elementId)
            )
        )
        .groupBy(
            dailyConfigurationMetrics.elementId,
            dailyConfigurationMetrics.parameterId,
            dailyConfigurationMetrics.value
        )
        .all();

    return rows.map((row) => ({ ...row, count: Number(row.count ?? 0) }));
}

function emptySparkline(): number[] {
    return Array.from({ length: MONTH_DAYS }, () => 0);
}

/**
 * Daily insert counts per part over the trailing window, as dense arrays the
 * table can plot directly.
 */
export async function getPartSparklines(
    db: Db,
    libraryId: LibraryId
): Promise<Map<string, number[]>> {
    const today = toDayKey(Date.now());
    const days = Array.from({ length: MONTH_DAYS }, (_, i) =>
        addDays(today, i - (MONTH_DAYS - 1))
    );
    const dayIndex = new Map(days.map((day, i) => [day, i]));

    // Summed over targets: a part inserted into both kinds of tab on one day
    // has a row apiece, and the sparkline plots the day.
    const rows = await db
        .select({
            elementId: dailyInsertableMetrics.elementId,
            day: dailyInsertableMetrics.day,
            count: sum(dailyInsertableMetrics.count)
        })
        .from(dailyInsertableMetrics)
        .where(
            and(
                eq(dailyInsertableMetrics.libraryId, libraryId),
                gte(dailyInsertableMetrics.day, days[0])
            )
        )
        .groupBy(dailyInsertableMetrics.elementId, dailyInsertableMetrics.day)
        .all();

    const byElement = new Map<string, number[]>();
    for (const row of rows) {
        const index = dayIndex.get(row.day);
        if (index === undefined) continue;
        const counts = byElement.get(row.elementId) ?? emptySparkline();
        counts[index] = Number(row.count ?? 0);
        byElement.set(row.elementId, counts);
    }
    return byElement;
}

/** The part's lifetime row, which is where its first use is recorded. */
export function getPartStats(db: Db, libraryId: LibraryId, elementId: string) {
    return db
        .select()
        .from(insertableStats)
        .where(
            and(
                eq(insertableStats.libraryId, libraryId),
                eq(insertableStats.elementId, elementId)
            )
        )
        .get();
}

/** The live insertable, absent once the part has left the library. */
export function getPartInsertable(
    db: Db,
    libraryId: LibraryId,
    elementId: string
) {
    return db
        .select({
            id: insertables.id,
            name: insertables.name,
            documentId: insertables.documentId,
            versionId: insertables.versionId
        })
        .from(insertables)
        .where(
            and(
                eq(insertables.libraryId, libraryId),
                eq(insertables.elementId, elementId)
            )
        )
        .get();
}

/** Distinct users of one part inside the window. */
export function countPartUsers(
    db: Db,
    libraryId: LibraryId,
    elementId: string,
    range: DayRange
) {
    return db
        .select({ value: countDistinct(dailyInsertableUsers.userId) })
        .from(dailyInsertableUsers)
        .where(
            and(
                eq(dailyInsertableUsers.libraryId, libraryId),
                eq(dailyInsertableUsers.elementId, elementId),
                gte(dailyInsertableUsers.day, range.from),
                lte(dailyInsertableUsers.day, range.to)
            )
        )
        .get();
}

/** One part's inserts inside the window, by the kind of tab they landed in. */
export function sumPartTargets(
    db: Db,
    libraryId: LibraryId,
    elementId: string,
    range: DayRange
) {
    return db
        .select({
            targetElementType: dailyInsertableMetrics.targetElementType,
            total: sum(dailyInsertableMetrics.count)
        })
        .from(dailyInsertableMetrics)
        .where(
            and(
                inWindow(libraryId, range),
                eq(dailyInsertableMetrics.elementId, elementId)
            )
        )
        .groupBy(dailyInsertableMetrics.targetElementType)
        .all();
}

/**
 * Favorites are keyed by insertable id, so a part that has left the library has
 * none to count.
 */
export function countPartFavorites(
    db: Db,
    libraryId: LibraryId,
    elementId: string
) {
    return db
        .select({ value: count() })
        .from(favorites)
        .innerJoin(insertables, eq(insertables.id, favorites.insertableId))
        .where(
            and(
                eq(insertables.libraryId, libraryId),
                eq(insertables.elementId, elementId)
            )
        )
        .get();
}

/**
 * The parameters the part declares today. The 1:1 configurations table is keyed
 * by insertable id, so they are only reachable through a live row.
 */
export async function getPartParameters(
    db: Db,
    insertableId: string | undefined
): Promise<ConfigurationParameter[]> {
    if (insertableId === undefined) return [];
    const row = await db
        .select({ parameters: configurations.parameters })
        .from(configurations)
        .where(eq(configurations.insertableId, insertableId))
        .get();
    return row?.parameters ?? [];
}

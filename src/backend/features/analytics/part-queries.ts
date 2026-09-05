/**
 * Reads of the per-part rollups: what a part was used for inside a window, and
 * how that lands day by day.
 */
import { and, eq, gte, lte, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import {
    dailyConfigurationMetrics,
    dailyInsertableMetrics
} from "../../db/schema";
import { LibraryId } from "../library/library-id";
import { type PartUsageOut } from "./contract";
import { SPARKLINE_DAYS, usesPerMonth } from "./measures";
import { toDayKey } from "./tracking";
import { type DayRange } from "./range";

export interface PartRow {
    elementId: string;
    insertableId: string;
    name: string;
    groupName: string;
    documentId: string;
    versionId: string;
    isVisible: boolean;
    firstInsertedAt: number | null;
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
    // A part first used inside the window is rated over the days it has
    // actually existed, not over the whole window, so arriving late is not
    // read as being unpopular.
    const firstUsed = Math.max(row.firstInsertedAt ?? from, from);

    return {
        elementId: row.elementId,
        insertableId: row.insertableId,
        name: row.name,
        groupName: row.groupName,
        documentId: row.documentId,
        versionId: row.versionId,
        isVisible: row.isVisible,
        insertCount,
        usesPerMonth: usesPerMonth(
            insertCount,
            insertCount === 0 ? null : firstUsed,
            to
        ),
        recent: series.get(row.elementId) ?? emptySparkline()
    };
}

/**
 * Inserts per element inside the window, keyed by element id.
 *
 * Folded out of the per-part daily rollup, which `daily_insertable_metrics_day_idx`
 * makes a range scan over one library's window.
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
    return Array.from({ length: SPARKLINE_DAYS }, () => 0);
}

/**
 * Daily insert counts per part over the trailing window, as dense arrays the
 * table can plot directly.
 */
export async function getPartSparklines(
    db: Db,
    libraryId: LibraryId
): Promise<Map<string, number[]>> {
    const now = Date.now();
    const days = Array.from({ length: SPARKLINE_DAYS }, (_, i) =>
        toDayKey(now - (SPARKLINE_DAYS - 1 - i) * 24 * 3600 * 1000)
    );
    const dayIndex = new Map(days.map((day, i) => [day, i]));

    const rows = await db
        .select({
            elementId: dailyInsertableMetrics.elementId,
            day: dailyInsertableMetrics.day,
            count: dailyInsertableMetrics.count
        })
        .from(dailyInsertableMetrics)
        .where(
            and(
                eq(dailyInsertableMetrics.libraryId, libraryId),
                gte(dailyInsertableMetrics.day, days[0])
            )
        )
        .all();

    const byElement = new Map<string, number[]>();
    for (const row of rows) {
        const index = dayIndex.get(row.day);
        if (index === undefined) continue;
        const counts = byElement.get(row.elementId) ?? emptySparkline();
        counts[index] = row.count;
        byElement.set(row.elementId, counts);
    }
    return byElement;
}

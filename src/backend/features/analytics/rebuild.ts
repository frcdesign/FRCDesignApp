/**
 * Recomputes the configuration rollup from the log. Every other rollup is
 * complete without it; this one is not, because a row written before an
 * insert's branch was keyed belongs to no branch, and so is counted nowhere.
 */
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { toInstanceKeys } from "../configurations/instances";
import { type LibraryId } from "../library/library-id";
import { asInsert } from "./logged-event";
import { dailyConfigurationMetrics, events } from "./schema";
import { type DayRange } from "./day";

/**
 * Events read per query. The log is walked rather than loaded: a season of it
 * does not fit in one D1 response.
 */
const PAGE = 500;

/**
 * Rows per insert. D1 binds at most 100 parameters to one statement and a row
 * here is seven columns, so fourteen is what fits.
 * https://developers.cloudflare.com/d1/platform/limits/
 */
const WRITE_BATCH = 14;

export interface RebuildResult {
    /** Insert events read; an app open has no configuration to count. */
    events: number;
    /** Rows written — distinct day, part, parameter, value and branch. */
    rows: number;
}

/**
 * The parameters each part declares now, by element id. A part that has left
 * the library has none, which keys its recorded values as branchless — what the
 * report already does with a parameter it can no longer see.
 */
async function getParameters(
    db: Db,
    libraryId: LibraryId
): Promise<Map<string, ConfigurationParameter[]>> {
    const rows = await db
        .select({
            elementId: insertables.elementId,
            parameters: configurations.parameters
        })
        .from(insertables)
        .innerJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(eq(insertables.libraryId, libraryId))
        .all();
    return new Map(rows.map((row) => [row.elementId, row.parameters]));
}

/** One counted row, keyed as the table keys it. */
function countKey(parts: string[]): string {
    return JSON.stringify(parts);
}

/**
 * Replays one library's insert log into `daily_configuration_metrics`, dropping
 * what is there for the days covered first. Idempotent: the same range replayed
 * twice lands on the same counts, and one that failed part-way leaves the range
 * short until it is run again.
 *
 * `range` is every recorded day by default. Narrow it to replay a long log in
 * slices — a row belongs to exactly one day, so each slice stands alone. The
 * counting is held in memory, which is the reason to slice a large one.
 */
export async function rebuildConfigurationMetrics(
    db: Db,
    libraryId: LibraryId,
    range?: DayRange
): Promise<RebuildResult> {
    const parameters = await getParameters(db, libraryId);
    const counts = new Map<string, number>();
    let read = 0;

    // Paged on (day, id): the day index carries the range, and the id breaks
    // the tie so a day spanning two pages resumes rather than repeats.
    let after = { day: range?.from ?? "", id: "" };

    for (;;) {
        const page = await db
            .select()
            .from(events)
            .where(
                and(
                    eq(events.libraryId, libraryId),
                    sql`(${events.day}, ${events.id}) > (${after.day}, ${after.id})`,
                    range ? lte(events.day, range.to) : undefined
                )
            )
            .orderBy(asc(events.day), asc(events.id))
            .limit(PAGE)
            .all();
        if (page.length === 0) break;

        const last = page[page.length - 1];
        after = { day: last.day, id: last.id };

        for (const row of page) {
            const insert = asInsert(row);
            if (!insert) continue;
            read++;

            const selection: Selection | null = insert.selection;
            if (!selection) continue;
            const keys = toInstanceKeys(
                selection,
                parameters.get(insert.elementId) ?? []
            );

            for (const [parameterId, value] of Object.entries(selection)) {
                const key = countKey([
                    insert.day,
                    insert.elementId,
                    parameterId,
                    value,
                    keys[parameterId] ?? ""
                ]);
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
    }

    await db
        .delete(dailyConfigurationMetrics)
        .where(
            and(
                eq(dailyConfigurationMetrics.libraryId, libraryId),
                range
                    ? gte(dailyConfigurationMetrics.day, range.from)
                    : undefined,
                range ? lte(dailyConfigurationMetrics.day, range.to) : undefined
            )
        );

    const rows = [...counts].map(([key, count]) => {
        const [day, elementId, parameterId, value, instanceKey] = JSON.parse(
            key
        ) as string[];
        return {
            day,
            libraryId,
            elementId,
            parameterId,
            value,
            instanceKey,
            count
        };
    });

    // Plain inserts: the rows this replaces were just dropped, and the counting
    // above already folded every duplicate, so a conflict here is a bug.
    for (let at = 0; at < rows.length; at += WRITE_BATCH) {
        await db
            .insert(dailyConfigurationMetrics)
            .values(rows.slice(at, at + WRITE_BATCH));
    }

    return { events: read, rows: rows.length };
}

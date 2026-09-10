import { sql, type SQL } from "drizzle-orm";
import { type SQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * Expressions for the `set` of an update or upsert, where the new value is
 * built from the stored one. Drizzle ships no equivalent, so they live here.
 */

/** `column + by`, for a row that counts rather than replaces. */
export function increment(column: SQLiteColumn, by: number | SQL = 1): SQL {
    return sql`${column} + ${by}`;
}

/**
 * Bounds rather than assignment, so writes reaching a row out of order — a
 * replay of the event log, say — still leave the true first and last. The
 * milliseconds are spelled out here because a raw `sql` fragment carries no
 * column codec to convert the Date for it.
 */
export function earliest(column: SQLiteColumn, value: Date): SQL {
    return sql`min(${column}, ${value.getTime()})`;
}

export function latest(column: SQLiteColumn, value: Date): SQL {
    return sql`max(${column}, ${value.getTime()})`;
}

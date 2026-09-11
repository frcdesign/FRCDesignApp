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
 * Bounds rather than assignment, so a write arriving out of order still leaves
 * the true first and last. Spelled in ms: a raw `sql` fragment has no codec.
 */
export function earliest(column: SQLiteColumn, value: Date): SQL {
    return sql`min(${column}, ${value.getTime()})`;
}

export function latest(column: SQLiteColumn, value: Date): SQL {
    return sql`max(${column}, ${value.getTime()})`;
}

import { sql, type SQL } from "drizzle-orm";
import { type SQLiteColumn } from "drizzle-orm/sqlite-core";

// Updates computed from the stored value, which Drizzle has no helper for.

export function increment(column: SQLiteColumn, by: number | SQL = 1): SQL {
    return sql`${column} + ${by}`;
}

/** Bounds, so out-of-order writes keep the true first and last. In ms, since raw `sql` has no codec. */
export function earliest(column: SQLiteColumn, value: Date): SQL {
    return sql`min(${column}, ${value.getTime()})`;
}

export function latest(column: SQLiteColumn, value: Date): SQL {
    return sql`max(${column}, ${value.getTime()})`;
}

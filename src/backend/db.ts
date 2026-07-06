import { drizzle } from "drizzle-orm/d1";
import { getTableColumns, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../shared/schema";

export function getDb(d1: D1Database) {
    return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;

/**
 * When writing a new row that conflicts with an existing one, overwrite every
 * column except the ones in `except`.
 */
export function conflictUpdateSet(
    table: SQLiteTable,
    except: string[]
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(getTableColumns(table))
            .filter(([key]) => !except.includes(key))
            .map(([key, col]) => [
                key,
                sql`excluded.${sql.identifier(col.name)}`
            ])
    );
}

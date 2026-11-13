import { drizzle } from "drizzle-orm/d1";
import * as analytics from "../features/analytics/schema";
import * as designCheck from "../features/design-check/schema";
import * as versionManager from "../features/version-manager/schema";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
    return drizzle(d1, {
        schema: { ...schema, ...analytics, ...designCheck, ...versionManager }
    });
}

export type Db = ReturnType<typeof getDb>;

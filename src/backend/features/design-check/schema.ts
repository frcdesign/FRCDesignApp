/** Kept out of `db/schema.ts`: a row names an Onshape user, not one of the app's rows. */

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** One row per person who changed a level; none for someone on FRCDesign's. */
export const designCheckLevels = sqliteTable("design_check_levels", {
    userId: text("user_id").primaryKey(),
    // As saved, which a later version may no longer know all of.
    levels: text("levels", { mode: "json" })
        .$type<Record<string, string>>()
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

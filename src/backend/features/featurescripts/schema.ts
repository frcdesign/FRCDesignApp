/**
 * The FeatureScripts tab's own tables, kept out of `db/schema.ts` because
 * nothing else reads them and they point at no library row.
 */

import {
    integer,
    primaryKey,
    sqliteTable,
    text
} from "drizzle-orm/sqlite-core";
import type { ThumbnailUrls } from "../thumbnails/contract";
import type { FeatureScriptProblem } from "./contract";

/** One row: the version of the frontend document the tab shows. */
export const featureScriptsDocument = sqliteTable("featurescripts_document", {
    documentId: text("document_id").primaryKey(),
    versionId: text("version_id").notNull(),
    /** Bumped by every load that wrote; the list is cached under it. */
    cacheVersion: integer("cache_version").notNull().default(0)
});

/** One per Feature Studio in the loaded version. */
export const featureScripts = sqliteTable("featurescripts", {
    /** Kept across loads for the same element, so urls and analytics stay put. */
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    elementId: text("element_id").notNull().unique(),
    /** Goes into the namespace a Part Studio imports the feature by. */
    microversionId: text("microversion_id").notNull(),
    /** The exported constant, which a Part Studio stores as the feature's type. */
    featureType: text("feature_type").notNull(),
    /** The Feature Type Name, never the tab's name. */
    name: text("name").notNull(),
    description: text("description").notNull(),
    /** The folder holding its Feature Studio in the frontend document; null at the top level. */
    category: text("category"),
    /** The owner's choice, which a load never writes; a new feature starts shown. */
    isVisible: integer("is_visible", { mode: "boolean" })
        .notNull()
        .default(true),
    exampleElementId: text("example_element_id"),
    exampleMicroversionId: text("example_microversion_id"),
    iconElementId: text("icon_element_id"),
    iconMicroversionId: text("icon_microversion_id"),
    thumbnailUrls: text("thumbnail_urls", {
        mode: "json"
    }).$type<ThumbnailUrls | null>(),
    problems: text("problems", { mode: "json" })
        .$type<FeatureScriptProblem[]>()
        .notNull()
        .default([]),
    sortOrder: integer("sort_order").notNull().default(0)
});

export type FeatureScriptRow = typeof featureScripts.$inferSelect;

/** Who favorited what; a feature gone from the document takes its favorites with it. */
export const featureScriptFavorites = sqliteTable(
    "featurescript_favorites",
    {
        userId: text("user_id").notNull(),
        featureScriptId: text("featurescript_id")
            .notNull()
            .references(() => featureScripts.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
    },
    (t) => [primaryKey({ columns: [t.userId, t.featureScriptId] })]
);

import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { ElementType } from "../lib/onshape/element-type";
import { FastenInfo } from "../features/library/insertables/fasten";
import { LibraryId } from "../features/library/library-id";
import { DEFAULT_SETTINGS, Theme } from "../features/settings/settings";
import { Vendor } from "../features/library/vendors";
import {
    ParameterValues,
    ConfigurationParameter,
    ConfigurationRecord,
    PartMetadata
} from "../features/configurations/models";
import { BuildIssue } from "../features/build-checker/issues";

export const libraries = sqliteTable("libraries", {
    id: text("id").primaryKey(),
    cacheVersion: integer("cache_version").notNull().default(0)
    // The serialized MiniSearch index now lives in R2 (see rebuildSearchDb),
    // keyed by library id, rather than in a D1 column.
});

/**
 * The `versionId` a group carries before a load pins a real one, so a group
 * whose load failed still has a row that can be seen, deleted, and retried.
 */
export const PLACEHOLDER_VERSION_ID = "placeholder";

export const group = sqliteTable(
    "groups",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        libraryId: text("library_id")
            .notNull()
            .$type<LibraryId>()
            .references(() => libraries.id),
        name: text("name").notNull(),
        // The Onshape document this group was added from
        documentId: text("document_id").notNull(),
        versionId: text("version_id").notNull(),
        sortAlphabetically: integer("sort_alphabetically", { mode: "boolean" })
            .notNull()
            .default(false),
        sortOrder: integer("sort_order").notNull().default(0),
        smallThumbnailUrl: text("small_thumbnail_url"),
        largeThumbnailUrl: text("large_thumbnail_url"),
        // Build-time issues flagged by the build checker, recomputed on reload.
        buildIssues: text("build_issues", { mode: "json" })
            .$type<BuildIssue[]>()
            .notNull()
            .default([]),
        // Epoch ms of the last successful load; null before the first. Failures
        // are conveyed by buildIssues, not here.
        lastLoadedAt: integer("last_loaded_at")
    },
    (t) => [unique().on(t.documentId, t.libraryId)]
);

export const insertables = sqliteTable("insertables", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    elementId: text("element_id").notNull(),
    // The group this insertable belongs to (its primary parent).
    groupId: text("group_id")
        .notNull()
        .references(() => group.id, { onDelete: "cascade" }),
    // The Onshape document the element lives in (kept for Onshape API calls).
    documentId: text("document_id").notNull(),
    libraryId: text("library_id")
        .notNull()
        .$type<LibraryId>()
        .references(() => libraries.id),
    name: text("name").notNull(),
    elementType: text("element_type").notNull().$type<ElementType>(),
    microversionId: text("microversion_id").notNull(),
    isVisible: integer("is_visible", { mode: "boolean" })
        .notNull()
        .default(false),
    isOpenComposite: integer("is_open_composite", { mode: "boolean" })
        .notNull()
        .default(false),
    supportsFasten: integer("supports_fasten", { mode: "boolean" })
        .notNull()
        .default(false),
    // Indexes this insertable's configurations even above the auto threshold.
    // User-owned; preserved across reloads.
    indexConfigurations: integer("index_configurations", { mode: "boolean" })
        .notNull()
        .default(false),
    versionId: text("version_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    vendors: text("vendors", { mode: "json" })
        .$type<Vendor[]>()
        .notNull()
        .default([]),
    smallThumbnailUrl: text("small_thumbnail_url"),
    largeThumbnailUrl: text("large_thumbnail_url"),
    fastenInfo: text("fasten_info", {
        mode: "json"
    }).$type<FastenInfo | null>(),
    // The element's own part identity, probed from its defaults. Null until a
    // probe succeeds; a configurable insertable left unindexed never gets one.
    partMetadata: text("part_metadata", {
        mode: "json"
    }).$type<PartMetadata | null>(),
    // Build-time issues flagged by the build checker, recomputed on reload.
    buildIssues: text("build_issues", { mode: "json" })
        .$type<BuildIssue[]>()
        .notNull()
        .default([]),
    // Epoch ms of the last successful load; null before the first. Failures are
    // conveyed by buildIssues, not here.
    lastLoadedAt: integer("last_loaded_at")
});

export const configurations = sqliteTable("configurations", {
    id: text("id")
        .primaryKey()
        .notNull()
        .references(() => insertables.id, { onDelete: "cascade" }),
    parameters: text("parameters", { mode: "json" })
        .$type<ConfigurationParameter[]>()
        .notNull()
        .default([]),
    // One record per indexed configuration. Empty unless the insertable is
    // indexed; the element's own metadata lives on `insertables.partMetadata`.
    records: text("records", { mode: "json" })
        .$type<ConfigurationRecord[]>()
        .notNull()
        .default([]),
    buildIssues: text("build_issues", { mode: "json" })
        .$type<BuildIssue[]>()
        .notNull()
        .default([])
});

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    theme: text("theme")
        .$type<Theme>()
        .notNull()
        .default(DEFAULT_SETTINGS.theme),
    libraryId: text("library_id")
        .$type<LibraryId>()
        .notNull()
        .default(DEFAULT_SETTINGS.libraryId)
});

export const favorites = sqliteTable(
    "favorites",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => users.id),
        libraryId: text("library_id")
            .notNull()
            .$type<LibraryId>()
            .references(() => libraries.id),
        insertableId: text("insertable_id")
            .notNull()
            .references(() => insertables.id, { onDelete: "cascade" }),
        defaultConfiguration: text("default_configuration", {
            mode: "json"
        }).$type<ParameterValues | null>(),
        sortOrder: integer("sort_order").notNull().default(0)
    },
    (t) => [unique().on(t.userId, t.libraryId, t.insertableId)]
);

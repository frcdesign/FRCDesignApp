import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import {
    DEFAULT_LIBRARY_ID,
    DEFAULT_SETTINGS,
    ElementType,
    FastenInfo,
    LibraryId,
    Theme,
    Vendor
} from "./types";
import {
    ParameterValues,
    ConfigurationParameter,
    ConfigurationRecord
} from "./configuration-models";
import { BuildIssue } from "./build-issues";

export const libraries = sqliteTable("libraries", {
    id: text("id").primaryKey(),
    cacheVersion: integer("cache_version").notNull().default(0)
    // The serialized MiniSearch index now lives in R2 (see rebuildSearchDb),
    // keyed by library id, rather than in a D1 column.
});

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
        // When this group was last successfully loaded (epoch ms). Null until the
        // group's first load. Written by the load path; failures are conveyed by
        // buildIssues, not here.
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
    // Forces part-number indexing on, overriding the vendor + configuration-count
    // heuristic. User-owned; preserved across reloads.
    forceIndex: integer("force_index", { mode: "boolean" })
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
    // Build-time issues flagged by the build checker, recomputed on reload.
    buildIssues: text("build_issues", { mode: "json" })
        .$type<BuildIssue[]>()
        .notNull()
        .default([]),
    // When this insertable was last successfully loaded (epoch ms). Null until the
    // insertable's first load. Written by the load path; failures are conveyed by
    // buildIssues, not here.
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
    // One record per configuration we probed (part number + metadata). Empty
    // unless the insertable is indexed. Search dedupes these to a part-number map.
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
        .default(DEFAULT_LIBRARY_ID)
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

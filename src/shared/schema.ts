import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import {
    DEFAULT_SETTINGS,
    ElementType,
    FastenInfo,
    LibraryId,
    Theme,
    Vendor
} from "./types";
import { ThumbnailUrls } from "./types";
import {
    Configuration,
    ParameterObj,
    PartNumberMap
} from "./configuration-models";
import { BuildIssue } from "./build-checker";

export const libraries = sqliteTable("libraries", {
    id: text("id").primaryKey(),
    cacheVersion: integer("cache_version").notNull().default(0),
    // Serialized MiniSearch index, rebuilt by the backend when a document loads.
    searchDb: text("search_db")
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
        thumbnailUrls: text("thumbnail_urls", {
            mode: "json"
        }).$type<ThumbnailUrls>(),
        // Build-time issues flagged by the build checker, recomputed on reload.
        buildIssues: text("build_issues", { mode: "json" })
            .$type<BuildIssue[]>()
            .notNull()
            .default([])
    },
    (t) => [unique().on(t.documentId, t.libraryId)]
);

export const insertables = sqliteTable(
    "insertables",
    {
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
            .default(true),
        isOpenComposite: integer("is_open_composite", { mode: "boolean" })
            .notNull()
            .default(false),
        supportsFasten: integer("supports_fasten", { mode: "boolean" })
            .notNull()
            .default(false),
        // Whether this insertable's part numbers are indexed for search.
        searchPartNumbers: integer("search_part_numbers", { mode: "boolean" })
            .notNull()
            .default(false),
        // Part number of the default configuration. The sole source of part
        // numbers for non-configurable insertables (which have no
        // `configurations` row); null when part-number search is off.
        defaultPartNumber: text("default_part_number"),
        versionId: text("version_id").notNull(),
        sortOrder: integer("sort_order").notNull().default(0),
        vendors: text("vendors", { mode: "json" })
            .$type<Vendor[]>()
            .notNull()
            .default([]),
        thumbnailUrls: text("thumbnail_urls", {
            mode: "json"
        }).$type<ThumbnailUrls | null>(),
        fastenInfo: text("fasten_info", {
            mode: "json"
        }).$type<FastenInfo | null>(),
        // Build-time issues flagged by the build checker, recomputed on reload.
        buildIssues: text("build_issues", { mode: "json" })
            .$type<BuildIssue[]>()
            .notNull()
            .default([])
    },
    (t) => [unique().on(t.elementId, t.groupId)]
);

export const configurations = sqliteTable("configurations", {
    id: text("id")
        .primaryKey()
        .notNull()
        .references(() => insertables.id, { onDelete: "cascade" }),
    parameters: text("parameters", { mode: "json" })
        .$type<ParameterObj[]>()
        .notNull()
        .default([]),
    // Deduped map of part number -> the configuration that produces it, used
    // for part-number search. Empty unless part-number search is enabled.
    partNumbers: text("part_numbers", { mode: "json" })
        .$type<PartNumberMap>()
        .notNull()
        .default({}),
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
        }).$type<Configuration | null>(),
        sortOrder: integer("sort_order").notNull().default(0)
    },
    (t) => [unique().on(t.userId, t.libraryId, t.insertableId)]
);

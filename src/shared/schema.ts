import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { ElementType, FastenInfo, Library, Theme, Vendor } from "./types";
import { ThumbnailUrls } from "./types";
import { Configuration, ParameterObj } from "./configuration-models";

export const libraries = sqliteTable("libraries", {
    id: text("id").primaryKey(),
    cacheVersion: integer("cache_version").notNull().default(0),
    // Serialized MiniSearch index, rebuilt by the backend when a document loads.
    searchDb: text("search_db")
});

export const documents = sqliteTable("documents", {
    id: text("id").primaryKey(),
    libraryId: text("library_id")
        .notNull()
        .references(() => libraries.id),
    name: text("name").notNull(),
    instanceId: text("instance_id").notNull(),
    sortAlphabetically: integer("sort_alphabetically", { mode: "boolean" })
        .notNull()
        .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    thumbnailUrls: text("thumbnail_urls", {
        mode: "json"
    }).$type<ThumbnailUrls>()
});

export const insertables = sqliteTable(
    "insertables",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        elementId: text("element_id").notNull(),
        documentId: text("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        libraryId: text("library_id")
            .notNull()
            .references(() => libraries.id),
        name: text("name").notNull(),
        elementType: text("element_type").notNull().$type<ElementType>(),
        microversionId: text("microversion_id").notNull(),
        versionName: text("version_name").notNull(),
        versionCreatedAt: text("version_created_at").notNull(),
        isVisible: integer("is_visible", { mode: "boolean" })
            .notNull()
            .default(true),
        isOpenComposite: integer("is_open_composite", { mode: "boolean" })
            .notNull()
            .default(false),
        supportsFasten: integer("supports_fasten", { mode: "boolean" })
            .notNull()
            .default(false),
        instanceId: text("instance_id").notNull(),
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
        }).$type<FastenInfo | null>()
    },
    (t) => [unique().on(t.elementId, t.documentId)]
);

export const configurations = sqliteTable("configurations", {
    id: text("id")
        .primaryKey()
        .notNull()
        .references(() => insertables.id, { onDelete: "cascade" }),
    parameters: text("parameters", { mode: "json" })
        .$type<ParameterObj[]>()
        .notNull()
        .default([])
});

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    theme: text("theme").$type<Theme>().notNull().default(Theme.SYSTEM),
    library: text("library")
        .$type<Library>()
        .notNull()
        .default(Library.FRC_DESIGN_LIB)
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

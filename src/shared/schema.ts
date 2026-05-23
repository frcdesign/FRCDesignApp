import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { FastenInfo } from "../backend/api/insert-and-fasten";
import { ThumbnailUrls } from "./types";

export const libraries = sqliteTable("libraries", {
    id: text("id").primaryKey(),
    cacheVersion: integer("cache_version").notNull().default(0),
    documentOrder: text("document_order", { mode: "json" })
        .$type<string[]>()
        .notNull()
        .default([])
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
    insertableOrder: text("insertable_order", { mode: "json" })
        .$type<string[]>()
        .notNull()
        .default([]),
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
        elementType: text("element_type").notNull(),
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
        vendors: text("vendors", { mode: "json" })
            .$type<string[]>()
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

export const configurations = sqliteTable(
    "configurations",
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
        parameters: text("parameters", { mode: "json" })
            .$type<unknown[]>()
            .notNull()
            .default([])
    },
    (t) => [unique().on(t.elementId, t.documentId)]
);

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    theme: text("theme").notNull().default("system"),
    library: text("library").notNull().default("frc-design-lib")
});

export const favorites = sqliteTable(
    "favorites",
    {
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
        }).$type<Record<string, string>>(),
        sortOrder: integer("sort_order").notNull().default(0)
    },
    (t) => [unique().on(t.userId, t.libraryId, t.insertableId)]
);

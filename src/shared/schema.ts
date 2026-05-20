import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

export const libraries = sqliteTable("libraries", {
    id: text("id").primaryKey(),
    cacheVersion: integer("cache_version").notNull().default(0),
    documentOrder: text("document_order").notNull().default("[]")
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
    elementOrder: text("element_order").notNull().default("[]"),
    thumbnailUrls: text("thumbnail_urls").notNull().default("{}"),
    versionName: text("version_name").notNull(),
    versionCreatedAt: text("version_created_at").notNull()
});

export const elements = sqliteTable("elements", {
    id: text("id").primaryKey(),
    documentId: text("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    libraryId: text("library_id")
        .notNull()
        .references(() => libraries.id),
    name: text("name").notNull(),
    elementType: text("element_type").notNull(),
    instanceId: text("instance_id").notNull(),
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
    vendors: text("vendors").notNull().default("[]"),
    configurationId: text("configuration_id"),
    thumbnailUrls: text("thumbnail_urls").notNull().default("{}"),
    fastenInfo: text("fasten_info")
});

export const configurations = sqliteTable("configurations", {
    id: text("id").primaryKey(),
    documentId: text("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    libraryId: text("library_id")
        .notNull()
        .references(() => libraries.id),
    parameters: text("parameters").notNull().default("[]")
});

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
        elementId: text("element_id").notNull(),
        defaultConfiguration: text("default_configuration"),
        sortOrder: integer("sort_order").notNull().default(0)
    },
    (t) => [unique().on(t.userId, t.libraryId, t.elementId)]
);

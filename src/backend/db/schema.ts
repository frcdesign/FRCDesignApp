import {
    sqliteTable,
    text,
    integer,
    unique,
    customType,
    primaryKey
} from "drizzle-orm/sqlite-core";
import { ElementType } from "../lib/onshape/element-type";
import { FastenInfo } from "../features/library/insertables/fasten";
import { DEFAULT_LIBRARY, LibraryId } from "../features/library/library-id";
import { AppTab } from "../features/settings/app-tab";
import { DEFAULT_THEME, Theme } from "../features/settings/settings";
import { Vendor } from "../features/library/vendors";
import {
    ConfigurationParameter,
    ConfigurationRecord,
    PartialSelection,
    PartMetadata
} from "../features/configurations/contract";
import { BuildIssue, knownBuildIssues } from "../features/build-checker/issues";

/** A JSON column whose stored rows may predate its current shape. */
function upgradedJson<T>(upgrade: (stored: T) => T) {
    return customType<{ data: T; driverData: string }>({
        dataType: () => "text",
        toDriver: (value) => JSON.stringify(value),
        fromDriver: (value) => upgrade(JSON.parse(value) as T)
    });
}

/**
 * Filtered on read: a row keeps whatever checks the deploy that wrote it knew,
 * so it can name one since removed.
 */
const buildIssues = () =>
    upgradedJson<BuildIssue[]>(knownBuildIssues)("build_issues")
        .notNull()
        .default([]);

/** The pair Onshape renders for a group or an insertable; null until rendered. */
const thumbnailUrls = () => ({
    smallThumbnailUrl: text("small_thumbnail_url"),
    largeThumbnailUrl: text("large_thumbnail_url")
});

const libraryId = () => text("library_id").$type<LibraryId>().notNull();

/** Null before the first successful load. Failures are conveyed by build issues. */
const lastLoadedAt = () => integer("last_loaded_at", { mode: "timestamp_ms" });

/** When Onshape cut the pinned version. Null until there is one. */
const versionCreatedAt = () =>
    integer("version_created_at", { mode: "timestamp_ms" });

export const libraries = sqliteTable("libraries", {
    id: text("id").$type<LibraryId>().primaryKey(),
    // The search index is in R2, keyed by library id; see rebuildSearchDb.
    cacheVersion: integer("cache_version").notNull().default(0),
    // Null until the owner sets one; until then only the owner can edit.
    adminTeamId: text("admin_team_id")
});

/** The admin team's members as of the last sync, replaced whole each time. */
export const adminTeamMembers = sqliteTable(
    "admin_team_members",
    {
        libraryId: libraryId().references(() => libraries.id, {
            onDelete: "cascade"
        }),
        userId: text("user_id").notNull(),
        isTeamAdmin: integer("is_team_admin", { mode: "boolean" }).notNull()
    },
    (t) => [primaryKey({ columns: [t.libraryId, t.userId] })]
);

/** Before a load pins a real version, so a failed group can still be retried. */
export const PLACEHOLDER_VERSION_ID = "placeholder";

export const groups = sqliteTable(
    "groups",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        libraryId: libraryId().references(() => libraries.id),
        name: text("name").notNull(),
        // The Onshape document this group was added from
        documentId: text("document_id").notNull(),
        versionId: text("version_id").notNull(),
        versionCreatedAt: versionCreatedAt(),
        // See `thumbnails/workspace.ts`. Null until a load has made one.
        thumbnailWorkspaceId: text("thumbnail_workspace_id"),
        sortAlphabetically: integer("sort_alphabetically", { mode: "boolean" })
            .notNull()
            .default(false),
        sortOrder: integer("sort_order").notNull().default(0),
        ...thumbnailUrls(),
        buildIssues: buildIssues(),
        lastLoadedAt: lastLoadedAt()
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
        .references(() => groups.id, { onDelete: "cascade" }),
    // The Onshape document the element lives in (kept for Onshape API calls).
    documentId: text("document_id").notNull(),
    libraryId: libraryId().references(() => libraries.id),
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
    // Set by an admin; kept across reloads.
    indexConfigurations: integer("index_configurations", { mode: "boolean" })
        .notNull()
        .default(false),
    // Set by an admin; kept across reloads.
    excludedParameterIds: text("excluded_parameter_ids", { mode: "json" })
        .$type<string[]>()
        .notNull()
        .default([]),
    versionId: text("version_id").notNull(),
    versionCreatedAt: versionCreatedAt(),
    sortOrder: integer("sort_order").notNull().default(0),
    vendors: text("vendors", { mode: "json" })
        .$type<Vendor[]>()
        .notNull()
        .default([]),
    ...thumbnailUrls(),
    fastenInfo: text("fasten_info", {
        mode: "json"
    }).$type<FastenInfo | null>(),
    // Null until probed; a configurable insertable left unindexed never is.
    partMetadata: text("part_metadata", {
        mode: "json"
    }).$type<PartMetadata | null>(),
    buildIssues: buildIssues(),
    lastLoadedAt: lastLoadedAt()
});

// Its own table because `parameters` and `records` are large and would slow
// every scan of `insertables`.
export const configurations = sqliteTable("configurations", {
    insertableId: text("insertable_id")
        .primaryKey()
        .references(() => insertables.id, { onDelete: "cascade" }),
    parameters: text("parameters", { mode: "json" })
        .$type<ConfigurationParameter[]>()
        .notNull()
        .default([]),
    // Empty unless indexed; the default part is `insertables.partMetadata`.
    records: text("records", { mode: "json" })
        .$type<ConfigurationRecord[]>()
        .notNull()
        .default([])
});

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    theme: text("theme").$type<Theme>().notNull().default(DEFAULT_THEME),
    // Unused, but SQLite can't drop a column in a foreign key, and D1 won't
    // rebuild the table while favorites reference it.
    libraryId: libraryId()
        .default(DEFAULT_LIBRARY)
        .references(() => libraries.id),
    // Null until one is picked. No foreign key: not every tab is a library.
    tabId: text("tab_id").$type<AppTab>(),
    // Null for the tab itself. A stale id resolves to that, so it isn't cleaned.
    groupId: text("group_id")
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
        libraryId: libraryId().references(() => libraries.id),
        insertableId: text("insertable_id")
            .notNull()
            .references(() => insertables.id, { onDelete: "cascade" }),
        // Null for an insertable with nothing to configure.
        defaultSelection: text("default_selection", {
            mode: "json"
        }).$type<PartialSelection | null>(),
        sortOrder: integer("sort_order").notNull().default(0),
        // Null on rows older than the column.
        createdAt: integer("created_at", { mode: "timestamp_ms" })
    },
    (t) => [unique().on(t.userId, t.libraryId, t.insertableId)]
);

export enum WebhookSubject {
    DOCUMENT = "document"
}

/**
 * One per subject. The token is stored before Onshape answers the create,
 * since Onshape calls the url before then.
 */
export const onshapeWebhooks = sqliteTable(
    "onshape_webhooks",
    {
        subject: text("subject").$type<WebhookSubject>().notNull(),
        // The document id.
        subjectId: text("subject_id").notNull(),
        webhookId: text("webhook_id"),
        token: text("token").notNull().unique()
    },
    (t) => [primaryKey({ columns: [t.subject, t.subjectId] })]
);

/**
 * At most one running load per group; a request meanwhile sets `rerun`. In D1
 * because concurrent writes to a KV list lose updates.
 */
export const loadJobs = sqliteTable("load_jobs", {
    groupId: text("group_id")
        .primaryKey()
        .references(() => groups.id, { onDelete: "cascade" }),
    libraryId: libraryId().references(() => libraries.id),
    // Null for the moment between claiming the row and the instance existing.
    instanceId: text("instance_id"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    rerun: integer("rerun", { mode: "boolean" }).notNull().default(false),
    // Whether the rerun reloads unchanged insertables too.
    rerunForce: integer("rerun_force", { mode: "boolean" })
        .notNull()
        .default(false)
});

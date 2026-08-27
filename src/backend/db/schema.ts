import {
    sqliteTable,
    text,
    integer,
    unique,
    index,
    primaryKey
} from "drizzle-orm/sqlite-core";
import { ElementType } from "../lib/onshape/element-type";
import { FastenInfo } from "../features/library/insertables/fasten";
import { LibraryId } from "../features/library/library-id";
import { DEFAULT_SETTINGS, Theme } from "../features/settings/settings";
import { Vendor } from "../features/library/vendors";
import {
    ConfigurationParameter,
    ConfigurationRecord,
    ParameterValues,
    PartMetadata
} from "../features/configurations/models";
import { BuildIssue } from "../features/build-checker/issues";
import { EventType, InsertSource } from "../features/analytics/events";

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
        .default(DEFAULT_SETTINGS.libraryId),
    // The group last opened in that library, which entry resumes in. Null for
    // the library itself; a stale one resolves to that, so it is never cleaned.
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
        libraryId: text("library_id")
            .notNull()
            .$type<LibraryId>()
            .references(() => libraries.id),
        insertableId: text("insertable_id")
            .notNull()
            .references(() => insertables.id, { onDelete: "cascade" }),
        // The selection the favorite opens with, as the user made it: a
        // canonical one would drop a default-valued or hidden parameter,
        // including a string they typed. Null for the element's own default.
        defaultConfiguration: text("default_configuration", {
            mode: "json"
        }).$type<ParameterValues | null>(),
        sortOrder: integer("sort_order").notNull().default(0),
        // Null on every row that predates this column. Deliberately not
        // backfilled: stamping them all with the migration date would draw a
        // cliff of favorites on a day nobody favorited anything.
        createdAt: integer("created_at")
    },
    (t) => [unique().on(t.userId, t.libraryId, t.insertableId)]
);

/**
 * Append-only usage log. Analytics is keyed on the Onshape `elementId` rather
 * than `insertables.id`, because a tab that is removed and re-added gets a fresh
 * app id (see `selectInsertablesToLoad`); the Onshape id keeps the history
 * attached across that. Deliberately has no foreign keys, so a library reload
 * dropping an insertable never cascades away its usage.
 */
export const events = sqliteTable(
    "events",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        type: text("type").notNull().$type<EventType>(),
        createdAt: integer("created_at").notNull(),
        // UTC YYYY-MM-DD, denormalized so rollups can be rebuilt with a GROUP BY
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        userId: text("user_id").notNull(),
        elementId: text("element_id"),
        // The app id at event time; kept for debugging, never joined on
        insertableId: text("insertable_id"),
        // The type of tab the user inserted into, not the insertable's own type
        targetElementType: text("target_element_type").$type<ElementType>(),
        configuration: text("configuration", {
            mode: "json"
        }).$type<ParameterValues | null>(),
        // Whether the part was favorited at insert time — not where the insert
        // came from; `source` carries that.
        isFavorite: integer("is_favorite", { mode: "boolean" }),
        isQuickInsert: integer("is_quick_insert", { mode: "boolean" }),
        source: text("source").$type<InsertSource>(),
        // Insert-and-fasten, which Onshape only offers for assembly targets.
        fasten: integer("fasten", { mode: "boolean" })
    },
    (t) => [
        index("events_day_idx").on(t.day),
        // Lets a single insertable's trend be read from raw events, so no
        // per-insertable daily rollup is needed.
        index("events_element_day_idx").on(t.libraryId, t.elementId, t.day)
    ]
);

/**
 * Per-day counts driving the range chart and the lifetime totals.
 *
 * The flag counters are subsets of `count` on insert rows (and always 0 on
 * app-open rows), which is what makes each one a percentage without needing its
 * own table or an extra write. `assemblyCount` is the denominator for
 * `fastenCount` rather than a flag in its own right: Onshape only offers
 * insert-and-fasten when the target tab is an assembly, so measuring it against
 * every insert would understate it by however many part-studio inserts happened.
 */
export const dailyMetrics = sqliteTable(
    "daily_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        type: text("type").notNull().$type<EventType>(),
        count: integer("count").notNull().default(0),
        favoriteCount: integer("favorite_count").notNull().default(0),
        fastenCount: integer("fasten_count").notNull().default(0),
        quickInsertCount: integer("quick_insert_count").notNull().default(0),
        assemblyCount: integer("assembly_count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.type] })]
);

/** Per-day inserts split by where they started, for the source breakdown. */
export const dailySourceMetrics = sqliteTable(
    "daily_source_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        source: text("source").notNull().$type<InsertSource>(),
        count: integer("count").notNull().default(0),
        quickInsertCount: integer("quick_insert_count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.source] })]
);

/** Lifetime per-part counts driving the parts table and the unused report. */
export const insertableStats = sqliteTable(
    "insertable_stats",
    {
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        elementId: text("element_id").notNull(),
        insertCount: integer("insert_count").notNull().default(0),
        firstInsertedAt: integer("first_inserted_at").notNull(),
        lastInsertedAt: integer("last_inserted_at").notNull()
    },
    (t) => [
        primaryKey({ columns: [t.libraryId, t.elementId] }),
        index("insertable_stats_count_idx").on(t.libraryId, t.insertCount)
    ]
);

/**
 * How often each configuration value was chosen, so a default that nobody wants
 * (or an option nobody picks) is visible.
 */
export const configurationValueStats = sqliteTable(
    "configuration_value_stats",
    {
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        elementId: text("element_id").notNull(),
        parameterId: text("parameter_id").notNull(),
        value: text("value").notNull(),
        count: integer("count").notNull().default(0)
    },
    (t) => [
        primaryKey({
            columns: [t.libraryId, t.elementId, t.parameterId, t.value]
        })
    ]
);

/**
 * One row per user per library per day.
 *
 * A distinct-user count is the one measure a counter cannot accumulate, so it
 * needs the identities kept per day. Storing them here rather than deriving
 * from `events` keeps reads off the event log: active users for a day is a
 * COUNT of an index range, and unique users over a range is a DISTINCT over a
 * table bounded by users x days rather than by every insert ever made.
 */
export const dailyUserActivity = sqliteTable(
    "daily_user_activity",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        userId: text("user_id").notNull()
    },
    (t) => [
        primaryKey({ columns: [t.day, t.libraryId, t.userId] }),
        index("daily_user_activity_day_idx").on(t.day)
    ]
);

/** One row per user per library, keeping unique-user counts a cheap COUNT. */
export const userStats = sqliteTable(
    "user_stats",
    {
        userId: text("user_id").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        insertCount: integer("insert_count").notNull().default(0),
        openCount: integer("open_count").notNull().default(0),
        firstSeenAt: integer("first_seen_at").notNull(),
        lastSeenAt: integer("last_seen_at").notNull()
    },
    (t) => [primaryKey({ columns: [t.userId, t.libraryId] })]
);

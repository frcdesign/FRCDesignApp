import {
    sqliteTable,
    text,
    integer,
    unique,
    customType
} from "drizzle-orm/sqlite-core";
import { ElementType } from "../lib/onshape/element-type";
import { FastenInfo } from "../features/library/insertables/fasten";
import { DEFAULT_LIBRARY, LibraryId } from "../features/library/library-id";
import { AppTab } from "../features/settings/app-tab";
import { DEFAULT_SETTINGS, Theme } from "../features/settings/settings";
import { Vendor } from "../features/library/vendors";
import {
    ConfigurationParameter,
    ConfigurationRecord,
    Selection,
    PartMetadata
} from "../features/configurations/contract";
import { BuildIssue, knownBuildIssues } from "../features/build-checker/issues";
import {
    upgradeParameters,
    upgradeRecords
} from "../features/configurations/legacy";

/** A JSON column whose stored rows may predate its current shape. */
function upgradedJson<T>(upgrade: (stored: T) => T) {
    return customType<{ data: T; driverData: string }>({
        dataType: () => "text",
        toDriver: (value) => JSON.stringify(value),
        fromDriver: (value) => upgrade(JSON.parse(value) as T)
    });
}

/**
 * Build-time issues flagged by the build checker, recomputed on reload. Declared
 * once because both tables carry exactly this column.
 *
 * Filtered on read rather than trusted: a stored array was written by whichever
 * deploy last loaded the row, so it can still name a check that has since been
 * removed. The next write of the row drops it for good.
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

/**
 * Ordered `$type` then constraints, so the column reads as what it holds before
 * what is true of it; the callers add their own `.references`.
 */
const libraryId = () => text("library_id").$type<LibraryId>().notNull();

/** Null before the first successful load. Failures are conveyed by build issues. */
const lastLoadedAt = () => integer("last_loaded_at", { mode: "timestamp_ms" });

/**
 * When Onshape cut the version this row is pinned to — what the row depicts,
 * rather than when we last asked. Null until the row has a real version.
 */
const versionCreatedAt = () =>
    integer("version_created_at", { mode: "timestamp_ms" });

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
    // Indexes this insertable's configurations even above the auto threshold.
    // User-owned; preserved across reloads.
    indexConfigurations: integer("index_configurations", { mode: "boolean" })
        .notNull()
        .default(false),
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
    // The element's own part identity, probed from its defaults. Null until a
    // probe succeeds; a configurable insertable left unindexed never gets one.
    partMetadata: text("part_metadata", {
        mode: "json"
    }).$type<PartMetadata | null>(),
    buildIssues: buildIssues(),
    lastLoadedAt: lastLoadedAt()
});

/**
 * Split off rather than folded into `insertables` because `parameters` and
 * `records` are large: inline, they would slow every scan of the library.
 */
export const configurations = sqliteTable("configurations", {
    insertableId: text("insertable_id")
        .primaryKey()
        .references(() => insertables.id, { onDelete: "cascade" }),
    parameters: upgradedJson<ConfigurationParameter[]>(upgradeParameters)(
        "parameters"
    )
        .notNull()
        .default([]),
    // One record per indexed configuration. Empty unless the insertable is
    // indexed; the element's own metadata lives on `insertables.partMetadata`.
    records: upgradedJson<ConfigurationRecord[]>(upgradeRecords)("records")
        .notNull()
        .default([])
});

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    theme: text("theme")
        .$type<Theme>()
        .notNull()
        .default(DEFAULT_SETTINGS.theme),
    // Dead, and not droppable: SQLite cannot drop a column named in a foreign
    // key, and rebuilding the table means dropping it, which D1 refuses while
    // favorites point at these rows. Its default is why a user row still needs
    // the default library to exist.
    libraryId: libraryId()
        .default(DEFAULT_LIBRARY)
        .references(() => libraries.id),
    // The tab last opened, which entry resumes in. Null until one is picked.
    // No foreign key: only some tabs name a library row.
    tabId: text("tab_id").$type<AppTab>(),
    // The group last opened in that tab, which entry resumes in. Null for the
    // tab itself; a stale one resolves to that, so it is never cleaned.
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
        // The selection the favorite opens with, whole and as it was entered.
        // Null for an insertable with nothing to configure.
        defaultSelection: text("default_selection", {
            mode: "json"
        }).$type<Selection | null>(),
        sortOrder: integer("sort_order").notNull().default(0),
        // Null on rows predating the column: backfilling would draw a cliff
        // of favorites on a day nobody favorited anything.
        createdAt: integer("created_at", { mode: "timestamp_ms" })
    },
    (t) => [unique().on(t.userId, t.libraryId, t.insertableId)]
);

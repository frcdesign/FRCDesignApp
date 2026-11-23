/** Kept out of `db/schema.ts`: no foreign key crosses between the two. */

import {
    sqliteTable,
    text,
    integer,
    index,
    primaryKey
} from "drizzle-orm/sqlite-core";
import { LibraryId } from "../library/library-id";
import { VersionJobKind } from "../version-manager/contract";
import {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic
} from "../feedback/contract";
import { AppFeature, EventType, UseSource, UseTarget } from "./usage";

// Not a D1 table: an event's columns are declared beside the event log.
export type { LoggedEvent } from "./event-columns";

/** Each flag counter is a subset of `count`. */
export const dailyMetrics = sqliteTable(
    "daily_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        type: text("type").notNull().$type<EventType>(),
        count: integer("count").notNull().default(0),
        favoriteCount: integer("favorite_count").notNull().default(0),
        fastenCount: integer("fasten_count").notNull().default(0),
        quickInsertCount: integer("quick_insert_count").notNull().default(0),
        /** Inserts into an assembly of a part offering insert and fasten. */
        fastenableCount: integer("fastenable_count").notNull().default(0),
        preselectedCount: integer("preselected_count").notNull().default(0),
        autoAssemblyCount: integer("auto_assembly_count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.type] })]
);

/** A row per target, so a new target needs no column. */
export const dailyTargetMetrics = sqliteTable(
    "daily_target_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        targetElementType: text("target_element_type")
            .notNull()
            .$type<UseTarget>(),
        count: integer("count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.targetElementType] })]
);

/** Per-day uses split by where they started, for the source breakdown. */
export const dailySourceMetrics = sqliteTable(
    "daily_source_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        source: text("source").notNull().$type<UseSource>(),
        count: integer("count").notNull().default(0),
        quickInsertCount: integer("quick_insert_count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.source] })]
);

/**
 * Lifetime per-part counts driving the parts table and the unused report. The
 * columns are named for inserts and count every use; see analytics.md.
 */
export const insertableStats = sqliteTable(
    "insertable_stats",
    {
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        elementId: text("element_id").notNull(),
        useCount: integer("insert_count").notNull().default(0),
        firstUsedAt: integer("first_inserted_at", {
            mode: "timestamp_ms"
        }).notNull(),
        lastUsedAt: integer("last_inserted_at", {
            mode: "timestamp_ms"
        }).notNull()
    },
    (t) => [
        primaryKey({ columns: [t.libraryId, t.elementId] }),
        index("insertable_stats_count_idx").on(t.libraryId, t.useCount)
    ]
);

/** Keyed part-first for one part's history; indexed by day for a library's. */
export const dailyInsertableMetrics = sqliteTable(
    "daily_insertable_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        elementId: text("element_id").notNull(),
        targetElementType: text("target_element_type")
            .notNull()
            .$type<UseTarget>(),
        count: integer("count").notNull().default(0)
    },
    (t) => [
        primaryKey({
            columns: [t.libraryId, t.elementId, t.day, t.targetElementType]
        }),
        index("daily_insertable_metrics_day_idx").on(t.libraryId, t.day)
    ]
);

/** Distinct users can't be summed, so identities are kept per day. */
export const dailyInsertableUsers = sqliteTable(
    "daily_insertable_users",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        elementId: text("element_id").notNull(),
        userId: text("user_id").notNull()
    },
    (t) => [
        primaryKey({
            columns: [t.libraryId, t.elementId, t.day, t.userId]
        })
    ]
);

export const dailyConfigurationMetrics = sqliteTable(
    "daily_configuration_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        elementId: text("element_id").notNull(),
        parameterId: text("parameter_id").notNull(),
        value: text("value").notNull(),
        /**
         * What the use chose for the parameters deciding whether this one was
         * shown, from `toInstanceKeys`. Empty for a parameter nothing conditions,
         * and on every row written before this column existed. Without it an
         * option two branches both offer cannot be counted for either.
         */
        instanceKey: text("instance_key").notNull().default(""),
        count: integer("count").notNull().default(0)
    },
    (t) => [
        primaryKey({
            columns: [
                t.libraryId,
                t.elementId,
                t.parameterId,
                t.value,
                t.instanceKey,
                t.day
            ]
        }),
        index("daily_configuration_metrics_day_idx").on(t.libraryId, t.day)
    ]
);

/** So distinct users is a count over days, not over every use. */
export const dailyUserActivity = sqliteTable(
    "daily_user_activity",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        userId: text("user_id").notNull()
    },
    (t) => [
        primaryKey({ columns: [t.day, t.libraryId, t.userId] }),
        index("daily_user_activity_day_idx").on(t.day)
    ]
);

/**
 * A day's launches from Onshape, per person. An open belongs to no library: it
 * is the app being opened, not the page it resumes into.
 */
export const dailyAppOpens = sqliteTable(
    "daily_app_opens",
    {
        day: text("day").notNull(),
        userId: text("user_id").notNull(),
        opens: integer("opens").notNull().default(0)
    },
    (t) => [
        primaryKey({ columns: [t.day, t.userId] }),
        // Covers summing a range's opens, which the primary key's index can't.
        index("daily_app_opens_day_opens_idx").on(t.day, t.opens)
    ]
);

/** One row per user per library, keeping unique-user counts a cheap COUNT. */
export const userStats = sqliteTable(
    "user_stats",
    {
        userId: text("user_id").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        // Every use, despite the column's name; see analytics.md.
        useCount: integer("insert_count").notNull().default(0),
        firstSeenAt: integer("first_seen_at", {
            mode: "timestamp_ms"
        }).notNull(),
        lastSeenAt: integer("last_seen_at", {
            mode: "timestamp_ms"
        }).notNull()
    },
    (t) => [primaryKey({ columns: [t.userId, t.libraryId] })]
);

/**
 * A day's pushes and pulls. Keyed by day and kind alone: a version run belongs
 * to the Onshape documents it touched, not to a library.
 */
export const dailyVersionMetrics = sqliteTable(
    "daily_version_metrics",
    {
        day: text("day").notNull(),
        kind: text("kind").notNull().$type<VersionJobKind>(),
        runs: integer("runs").notNull().default(0),
        updateOnlyRuns: integer("update_only_runs").notNull().default(0),
        /** Runs that failed partway, having changed something. */
        partialRuns: integer("partial_runs").notNull().default(0),
        failedRuns: integer("failed_runs").notNull().default(0),
        createdVersions: integer("created_versions").notNull().default(0),
        updatedElements: integer("updated_elements").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.kind] })]
);

/**
 * A day's reports. Keyed by topic rather than library, since the app's own
 * topics belong to none; a topic names its library when it has one.
 */
export const dailyReportMetrics = sqliteTable(
    "daily_report_metrics",
    {
        day: text("day").notNull(),
        topic: text("topic").notNull().$type<FeedbackTopic>(),
        category: text("category").notNull().$type<FeedbackCategory>(),
        source: text("source").notNull().$type<FeedbackSource>(),
        /** The reported part's; empty for a report that names none. */
        elementId: text("element_id").notNull().default(""),
        count: integer("count").notNull().default(0)
    },
    (t) => [
        primaryKey({
            columns: [t.day, t.topic, t.category, t.source, t.elementId]
        })
    ]
);

/**
 * A day's FeatureScript adds, by feature. Keyed by the feature's constant
 * rather than a row, so a feature's history outlasts its row being replaced.
 */
export const dailyFeatureScriptMetrics = sqliteTable(
    "daily_featurescript_metrics",
    {
        day: text("day").notNull(),
        featureType: text("feature_type").notNull(),
        adds: integer("adds").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.featureType] })]
);

/** Who added each feature on a day, so distinct users come from rollups. */
export const dailyFeatureScriptUsers = sqliteTable(
    "daily_featurescript_users",
    {
        day: text("day").notNull(),
        featureType: text("feature_type").notNull(),
        userId: text("user_id").notNull()
    },
    (t) => [primaryKey({ columns: [t.day, t.featureType, t.userId] })]
);

/** Who used each feature on a day, so a week's reach is a distinct count over rollups. */
export const dailyFeatureUsers = sqliteTable(
    "daily_feature_users",
    {
        day: text("day").notNull(),
        feature: text("feature").notNull().$type<AppFeature>(),
        userId: text("user_id").notNull()
    },
    // Feature first, so a feature's first recorded day is an index seek.
    (t) => [primaryKey({ columns: [t.feature, t.day, t.userId] })]
);

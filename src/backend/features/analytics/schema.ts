/** Kept out of `db/schema.ts`: no foreign key crosses between the two. */

import {
    sqliteTable,
    text,
    integer,
    index,
    primaryKey
} from "drizzle-orm/sqlite-core";
import { ElementType } from "../../lib/onshape/element-type";
import { type InstanceType } from "../../lib/onshape/path";
import { LibraryId } from "../library/library-id";
import { Selection } from "../configurations/contract";
import { EventType, InsertSource } from "./usage";

/**
 * Append-only. Keyed on Onshape's `elementId` with no foreign keys, so a reload
 * or re-added tab keeps history.
 */
export const events = sqliteTable(
    "events",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        type: text("type").notNull().$type<EventType>(),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
        // UTC YYYY-MM-DD, denormalized so rollups can be rebuilt with a GROUP BY
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        userId: text("user_id").notNull(),
        /** Rows predating the column were version 1. */
        schemaVersion: integer("schema_version").notNull().default(1),
        // The versioned path, since the library row moves on after a reload.
        elementId: text("element_id"),
        documentId: text("document_id"),
        instanceId: text("instance_id"),
        instanceType: text("instance_type").$type<InstanceType>(),
        // The app id at event time; kept for debugging, never joined on
        insertableId: text("insertable_id"),
        // The type of tab the user inserted into, not the insertable's own type
        targetElementType: text("target_element_type").$type<ElementType>(),
        // What the insert applied, minus the parameters it hid.
        selection: text("selection", {
            mode: "json"
        }).$type<Selection | null>(),
        // Favorited at insert time; `source` says where the insert came from.
        isFavorite: integer("is_favorite", { mode: "boolean" }),
        isQuickInsert: integer("is_quick_insert", { mode: "boolean" }),
        source: text("source").$type<InsertSource>(),
        // Insert-and-fasten, which Onshape only offers for assembly targets.
        fasten: integer("fasten", { mode: "boolean" })
    },
    // Only used to rebuild the rollups, which walk by day.
    (t) => [index("events_day_idx").on(t.day)]
);

/** One row of the log: everything the rollups are derived from. */
export type LoggedEvent = typeof events.$inferSelect;

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
        quickInsertCount: integer("quick_insert_count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.type] })]
);

/** A row per type, so a new target type needs no column. */
export const dailyTargetMetrics = sqliteTable(
    "daily_target_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        targetElementType: text("target_element_type")
            .notNull()
            .$type<ElementType>(),
        count: integer("count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.targetElementType] })]
);

/** Per-day inserts split by where they started, for the source breakdown. */
export const dailySourceMetrics = sqliteTable(
    "daily_source_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
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
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        elementId: text("element_id").notNull(),
        insertCount: integer("insert_count").notNull().default(0),
        firstInsertedAt: integer("first_inserted_at", {
            mode: "timestamp_ms"
        }).notNull(),
        lastInsertedAt: integer("last_inserted_at", {
            mode: "timestamp_ms"
        }).notNull()
    },
    (t) => [
        primaryKey({ columns: [t.libraryId, t.elementId] }),
        index("insertable_stats_count_idx").on(t.libraryId, t.insertCount)
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
            .$type<ElementType>(),
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
        count: integer("count").notNull().default(0)
    },
    (t) => [
        primaryKey({
            columns: [t.libraryId, t.elementId, t.parameterId, t.value, t.day]
        }),
        index("daily_configuration_metrics_day_idx").on(t.libraryId, t.day)
    ]
);

/** So distinct users is a count over days, not over every insert. */
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

/** One row per user per library, keeping unique-user counts a cheap COUNT. */
export const userStats = sqliteTable(
    "user_stats",
    {
        userId: text("user_id").notNull(),
        libraryId: text("library_id").$type<LibraryId>().notNull(),
        insertCount: integer("insert_count").notNull().default(0),
        openCount: integer("open_count").notNull().default(0),
        firstSeenAt: integer("first_seen_at", {
            mode: "timestamp_ms"
        }).notNull(),
        lastSeenAt: integer("last_seen_at", {
            mode: "timestamp_ms"
        }).notNull()
    },
    (t) => [primaryKey({ columns: [t.userId, t.libraryId] })]
);

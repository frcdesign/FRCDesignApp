/**
 * Tracking's own tables, kept out of `db/schema.ts` because nothing here points
 * at the app's data: the log is keyed on Onshape ids and the rollups are
 * derived from it, so the two sides share no foreign key.
 */

import {
    sqliteTable,
    text,
    integer,
    index,
    primaryKey
} from "drizzle-orm/sqlite-core";
import { ElementType } from "../../lib/onshape/element-type";
import { LibraryId } from "../library/library-id";
import { Selection } from "../configurations/models";
import { EventType, InsertSource } from "./events";

/**
 * Append-only usage log, keyed on the Onshape `elementId` and free of foreign
 * keys: a re-added tab gets a fresh app id, and a reload must not drop history.
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
        // What the insert applied, minus the parameters it hid.
        selection: text("selection", {
            mode: "json"
        }).$type<Selection | null>(),
        // Whether the part was favorited at insert time — not where the insert
        // came from; `source` carries that.
        isFavorite: integer("is_favorite", { mode: "boolean" }),
        isQuickInsert: integer("is_quick_insert", { mode: "boolean" }),
        source: text("source").$type<InsertSource>(),
        // Insert-and-fasten, which Onshape only offers for assembly targets.
        fasten: integer("fasten", { mode: "boolean" })
    },
    // Indexed by day alone: nothing reads the log to report a metric, so this
    // exists to rebuild the rollups below, which is a walk through time.
    (t) => [index("events_day_idx").on(t.day)]
);

/** One row of the log: everything the rollups are derived from. */
export type LoggedEvent = typeof events.$inferSelect;

/** What every event carries, whatever kind of event it is. */
export type EventCore = Pick<
    LoggedEvent,
    "id" | "type" | "createdAt" | "day" | "libraryId" | "userId"
>;

/** The rest, which only an insert fills in. */
export type InsertColumns = Omit<LoggedEvent, keyof EventCore>;

/**
 * Per-day counts. Each flag counter is a subset of `count`, and so a percentage
 * of it. Fasten's denominator is not here: it is the assembly row of
 * {@link dailyTargetMetrics}, since Onshape only offers it on an assembly.
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
        quickInsertCount: integer("quick_insert_count").notNull().default(0)
    },
    (t) => [primaryKey({ columns: [t.day, t.libraryId, t.type] })]
);

/**
 * Per-day inserts split by the kind of tab they landed in. A dimension rather
 * than a counter per type, so a new kind of target needs no column.
 */
export const dailyTargetMetrics = sqliteTable(
    "daily_target_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
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
 * Per-day counts for one part, split by target as {@link dailyTargetMetrics} is.
 * Keyed part-first for one part's history, indexed by day for a whole library's.
 */
export const dailyInsertableMetrics = sqliteTable(
    "daily_insertable_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
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

/**
 * {@link dailyUserActivity} narrowed to one part: a distinct-user count is the
 * one measure a counter cannot accumulate, so the identities are kept per day.
 */
export const dailyInsertableUsers = sqliteTable(
    "daily_insertable_users",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
        elementId: text("element_id").notNull(),
        userId: text("user_id").notNull()
    },
    (t) => [
        primaryKey({
            columns: [t.libraryId, t.elementId, t.day, t.userId]
        })
    ]
);

/**
 * How often each configuration value was chosen, per day, so a default that
 * nobody wants (or an option nobody picks) is visible over any window.
 */
export const dailyConfigurationMetrics = sqliteTable(
    "daily_configuration_metrics",
    {
        day: text("day").notNull(),
        libraryId: text("library_id").notNull().$type<LibraryId>(),
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

/**
 * One row per user per library per day, so a distinct-user count is a DISTINCT
 * over users x days rather than over every insert ever made.
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

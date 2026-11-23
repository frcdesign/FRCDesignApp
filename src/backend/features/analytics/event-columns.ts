import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { ElementType } from "../../lib/onshape/element-type";
import { type InstanceType } from "../../lib/onshape/path";
import { LibraryId } from "../library/library-id";
import { Selection } from "../configurations/contract";
import {
    PullScopeKind,
    PushScopeKind,
    VersionJobKind,
    VersionJobOutcome
} from "../version-manager/contract";
import {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic
} from "../feedback/contract";
import {
    type DesignIssueCounts,
    type DesignIssueType
} from "../design-check/contract";
import { EventType, UseSource } from "./usage";

/**
 * An event's columns: what tracking records, and the names the event log's
 * `data` keys them by. Declared as a table for its types and column names;
 * no migration creates it, since the log is in R2 (`event-log.ts`).
 */
export const eventColumns = sqliteTable("events", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    type: text("type").notNull().$type<EventType>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    // YYYY-MM-DD in the reporting time zone (`toDayKey`), so rollups rebuild with a GROUP BY
    day: text("day").notNull(),
    /** Null for an event that belongs to no library, such as a version run. */
    libraryId: text("library_id").$type<LibraryId>(),
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
    // The type of tab the user inserted into, not the insertable's own type; null for a download
    targetElementType: text("target_element_type").$type<ElementType>(),
    // What the insert or download applied, minus the parameters it hid.
    selection: text("selection", {
        mode: "json"
    }).$type<Selection | null>(),
    // Favorited at the time of the use; `source` says where the use started.
    isFavorite: integer("is_favorite", { mode: "boolean" }),
    isQuickInsert: integer("is_quick_insert", { mode: "boolean" }),
    source: text("source").$type<UseSource>(),
    // Insert-and-fasten, which Onshape only offers for assembly targets.
    fasten: integer("fasten", { mode: "boolean" }),
    // Whether the part offered insert and fasten when it was inserted.
    fastenable: integer("fastenable", { mode: "boolean" }),
    // Fastened to circular edges or faces picked in Onshape beforehand.
    preselected: integer("preselected", { mode: "boolean" }),
    // Placed at the assembly's insert location marker; null before schema version 4.
    atInsertLocation: integer("at_insert_location", { mode: "boolean" }),
    // A version run's own columns: how it was aimed, and what it did.
    versionKind: text("version_kind").$type<VersionJobKind>(),
    versionScope: text("version_scope").$type<PushScopeKind | PullScopeKind>(),
    versionUpdateOnly: integer("version_update_only", { mode: "boolean" }),
    versionOutcome: text("version_outcome").$type<VersionJobOutcome>(),
    failedSteps: integer("failed_steps"),
    createdVersions: integer("created_versions"),
    updatedElements: integer("updated_elements"),
    // A report's own columns; a part report also sets the element's.
    reportTopic: text("report_topic").$type<FeedbackTopic>(),
    reportCategory: text("report_category").$type<FeedbackCategory>(),
    reportSource: text("report_source").$type<FeedbackSource>(),
    reportTeamNumber: integer("report_team_number"),
    // The FeatureScript an add or a report names: its constant, which never changes once released.
    featureType: text("feature_type"),
    // A design check's own columns: the kind of tab it read, and what it found there.
    checkedElementType: text("checked_element_type").$type<ElementType>(),
    designIssueCounts: text("design_issue_counts", {
        mode: "json"
    }).$type<DesignIssueCounts | null>(),
    // What a design fix or dismissal was about.
    designIssueType: text("design_issue_type").$type<DesignIssueType>()
});

/** One row of the log: everything the rollups are derived from. */
export type LoggedEvent = typeof eventColumns.$inferSelect;

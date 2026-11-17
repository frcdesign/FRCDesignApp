import type { BatchItem } from "drizzle-orm/batch";
import { runInBackground } from "../../lib/background";
import { type AppBindings, type AppContext } from "../../lib/context";
import { getDb, type Db } from "../../db/client";
import { events, type LoggedEvent } from "./schema";
import {
    NO_ELEMENT,
    NOT_A_USE,
    NOT_A_FEATURE_ADD,
    NOT_A_REPORT,
    NOT_A_VERSION_RUN,
    SIGNED_OUT_USER_ID,
    NOT_A_DESIGN_CHECK,
    type ElementColumns,
    type EventCore
} from "./logged-event";
import { rollupWrites } from "./rollups";
import { EVENT_SCHEMA_VERSION, EventType, UseSource } from "./usage";
import {
    failedTaskCount,
    jobOutcome,
    VersionJobOutcome,
    type PullScopeKind,
    type VersionJobKind,
    type PushScopeKind,
    type VersionJobStatus
} from "../version-manager/contract";
import { type LibraryId } from "../library/library-id";
import { type ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { canonicalValues } from "../configurations/selection";
import { toDayKey } from "./day";
import {
    countDesignIssues,
    type DesignIssue,
    type DesignIssueType
} from "../design-check/contract";
import type {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic
} from "../feedback/contract";

/** What every use records, an insert or a download. The caller is the user. */
export interface UseEvent {
    libraryId: LibraryId;
    /** The rollups key on the element id; the rest records the version. */
    path: ElementPath;
    insertableId: string;
    /** The whole selection the use applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Passed in, since the route already loaded them. */
    parameters: ConfigurationParameter[];
    /** Whether the part was favorited, not where the use came from. */
    isFavorite: boolean;
    source: UseSource;
}

export interface InsertEvent extends UseEvent {
    /** The type of tab the user inserted into. */
    targetElementType: ElementType;
    isQuickInsert: boolean;
    fasten: boolean;
    /** Whether the part offered insert and fasten. */
    fastenable: boolean;
    /** Fastened to circular edges or faces picked in Onshape beforehand. */
    preselected: boolean;
    /** Placed at the assembly's insert location marker. */
    atInsertLocation: boolean;
}

/**
 * After the response, and never failing it: tracking is not what was asked
 * for. Each of the `instances` the insert placed is a use of its own.
 */
export function trackInsert(
    c: AppContext,
    event: InsertEvent,
    instances = 1
): Promise<void> {
    return runInBackground(c, "record an insert", async () =>
        recordInserts(
            getDb(c.env.DB),
            await c.var.getUserId(),
            Array.from({ length: instances }, () => event)
        )
    );
}

/** One event per insert, all in one batch; for a caller with no request to track from. */
export async function recordInserts(
    db: Db,
    userId: string,
    inserts: InsertEvent[]
): Promise<void> {
    await recordBatch(
        db,
        inserts.map((event) => ({
            event: {
                ...columnsOfUse(EventType.INSERT, event, userId),
                targetElementType: event.targetElementType,
                isQuickInsert: event.isQuickInsert,
                fasten: event.fasten,
                fastenable: event.fastenable,
                preselected: event.preselected,
                atInsertLocation: event.atInsertLocation
            },
            parameters: event.parameters
        }))
    );
}

/** As `trackInsert`, for a STEP export Onshape has accepted. */
export function trackDownload(c: AppContext, event: UseEvent): Promise<void> {
    return runInBackground(c, "record a download", async () =>
        record(
            getDb(c.env.DB),
            {
                ...columnsOfUse(
                    EventType.DOWNLOAD,
                    event,
                    await c.var.getUserId()
                ),
                targetElementType: null,
                isQuickInsert: null,
                fasten: null,
                fastenable: null,
                preselected: null,
                atInsertLocation: null
            },
            event.parameters
        )
    );
}

/** The columns every use fills in; its kind adds the rest. */
function columnsOfUse(
    type: EventType.INSERT | EventType.DOWNLOAD,
    event: UseEvent,
    userId: string
) {
    return {
        ...eventCore(type, event.libraryId, userId),
        ...NOT_A_VERSION_RUN,
        ...NOT_A_REPORT,
        ...NOT_A_FEATURE_ADD,
        ...NOT_A_DESIGN_CHECK,
        ...event.path,
        insertableId: event.insertableId,
        selection: appliedSelection(event.selection, event.parameters),
        isFavorite: event.isFavorite,
        source: event.source
    };
}

/** As `trackInsert`, for a launch from Onshape. */
export function trackAppOpen(c: AppContext): Promise<void> {
    return runInBackground(c, "record an app open", async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(EventType.APP_OPEN, null, await c.var.getUserId()),
                ...NO_ELEMENT,
                ...NOT_A_USE,
                ...NOT_A_VERSION_RUN,
                ...NOT_A_REPORT,
                ...NOT_A_FEATURE_ADD,
                ...NOT_A_DESIGN_CHECK
            },
            []
        )
    );
}

/** Canonical, so "5 in" and "(2 + 3) in" count as one. Null when there's nothing to configure. */
function appliedSelection(
    selection: Selection | undefined,
    parameters: ConfigurationParameter[]
): Selection | null {
    if (!selection || parameters.length === 0) return null;
    return canonicalValues(selection, parameters);
}

/** What every logged event carries; its kind fills in the rest. */
function eventCore(
    type: EventType,
    libraryId: LibraryId | null,
    userId: string,
    id: string = crypto.randomUUID()
): EventCore {
    const now = Date.now();
    return {
        id,
        type,
        createdAt: new Date(now),
        day: toDayKey(now),
        libraryId,
        userId,
        schemaVersion: EVENT_SCHEMA_VERSION
    };
}

/** A finished push or pull; see `features/version-manager`. */
export interface VersionRunEvent {
    userId: string;
    kind: VersionJobKind;
    scope: PushScopeKind | PullScopeKind;
    /** How it ended. */
    status: VersionJobStatus;
}

/** Recorded by the workflow once the run has ended, however it ended. */
export async function trackVersionRun(
    env: AppBindings,
    event: VersionRunEvent
): Promise<void> {
    const { status } = event;
    await record(
        getDb(env.DB),
        {
            ...eventCore(EventType.VERSION_RUN, null, event.userId),
            ...NO_ELEMENT,
            ...NOT_A_USE,
            ...NOT_A_REPORT,
            ...NOT_A_FEATURE_ADD,
            ...NOT_A_DESIGN_CHECK,
            versionKind: event.kind,
            versionScope: event.scope,
            versionUpdateOnly: status.updateOnly ?? false,
            versionOutcome: jobOutcome(status) ?? VersionJobOutcome.FAILED,
            failedSteps: failedTaskCount(status),
            createdVersions: status.result?.createdVersions ?? 0,
            updatedElements: status.result?.updatedElements ?? 0
        },
        []
    );
}

/** A report already posted to Discord; see `features/feedback`. */
export interface ReportEvent {
    /** The id the Discord post quotes, so the two can be matched. */
    id: string;
    /** Undefined for a reporter who isn't signed in. */
    userId: string | undefined;
    /** The topic's library, when it has one. */
    libraryId: LibraryId | undefined;
    topic: FeedbackTopic;
    category: FeedbackCategory;
    source: FeedbackSource;
    /** The reporter's FRC or FTC team, when they gave it. */
    teamNumber?: number;
    /** Set for a report from a part's menu. */
    part?: { path: ElementPath; insertableId: string };
    /** The constant of the FeatureScript a report names. */
    featureType?: string;
}

/** As `trackInsert`: the report has been sent, whatever happens to its record. */
export function trackReport(c: AppContext, event: ReportEvent): Promise<void> {
    const element: ElementColumns = event.part
        ? { ...event.part.path, insertableId: event.part.insertableId }
        : NO_ELEMENT;
    return runInBackground(c, "record a report", () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(
                    EventType.REPORT,
                    event.libraryId ?? null,
                    event.userId ?? SIGNED_OUT_USER_ID,
                    event.id
                ),
                ...element,
                ...NOT_A_USE,
                ...NOT_A_VERSION_RUN,
                featureType: event.featureType ?? null,
                ...NOT_A_DESIGN_CHECK,
                reportTopic: event.topic,
                reportCategory: event.category,
                reportSource: event.source,
                reportTeamNumber: event.teamNumber ?? null
            },
            []
        )
    );
}

/** A FeatureScript added to a Part Studio; `path` is its Feature Studio in the loaded version. */
export interface FeatureAddEvent {
    featureType: string;
    path: ElementPath;
}

/** As `trackInsert`, once Onshape accepted the feature. Not a use: it belongs to no library. */
export function trackFeatureAdd(
    c: AppContext,
    event: FeatureAddEvent
): Promise<void> {
    return runInBackground(c, "record a FeatureScript add", async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(
                    EventType.FEATURE_ADD,
                    null,
                    await c.var.getUserId()
                ),
                ...event.path,
                insertableId: null,
                ...NOT_A_USE,
                ...NOT_A_VERSION_RUN,
                ...NOT_A_REPORT,
                ...NOT_A_DESIGN_CHECK,
                featureType: event.featureType
            },
            []
        )
    );
}

/** A favorite's default configuration, saved; `path` is its part in the loaded version. */
export interface DefaultSelectionEvent {
    libraryId: LibraryId;
    path: ElementPath;
    insertableId: string;
}

/** As `trackInsert`, once the default is saved. Not a use: nothing was placed. */
export function trackDefaultSelection(
    c: AppContext,
    event: DefaultSelectionEvent
): Promise<void> {
    return runInBackground(c, "record a default configuration", async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(
                    EventType.DEFAULT_SELECTION,
                    event.libraryId,
                    await c.var.getUserId()
                ),
                ...event.path,
                insertableId: event.insertableId,
                ...NOT_A_USE,
                ...NOT_A_VERSION_RUN,
                ...NOT_A_REPORT,
                ...NOT_A_FEATURE_ADD,
                ...NOT_A_DESIGN_CHECK
            },
            []
        )
    );
}

/** A finished check of the caller's own tab; see `features/design-check`. */
export interface DesignCheckEvent {
    elementType: ElementType;
    issues: DesignIssue[];
}

/** As `trackInsert`: the check has answered, whatever happens to its record. */
export function trackDesignCheck(
    c: AppContext,
    event: DesignCheckEvent
): Promise<void> {
    return runInBackground(c, "record a design check", async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(
                    EventType.DESIGN_CHECK,
                    null,
                    await c.var.getUserId()
                ),
                // Someone's own document, not a library's part.
                ...NO_ELEMENT,
                ...NOT_A_USE,
                ...NOT_A_VERSION_RUN,
                ...NOT_A_REPORT,
                ...NOT_A_FEATURE_ADD,
                checkedElementType: event.elementType,
                designIssueCounts: countDesignIssues(event.issues),
                designIssueType: null
            },
            []
        )
    );
}

/** As `trackDesignCheck`, once a fix is made or an issue dismissed. */
export function trackDesignAction(
    c: AppContext,
    type: EventType.DESIGN_FIX | EventType.DESIGN_DISMISS,
    issueType: DesignIssueType
): Promise<void> {
    return runInBackground(c, `record a ${type}`, async () =>
        record(
            getDb(c.env.DB),
            {
                ...eventCore(type, null, await c.var.getUserId()),
                ...NO_ELEMENT,
                ...NOT_A_USE,
                ...NOT_A_VERSION_RUN,
                ...NOT_A_REPORT,
                ...NOT_A_FEATURE_ADD,
                ...NOT_A_DESIGN_CHECK,
                designIssueType: issueType
            },
            []
        )
    );
}

/** Batched so neither half lands without the other. */
function record(
    db: Db,
    event: LoggedEvent,
    parameters: ConfigurationParameter[]
): Promise<void> {
    return recordBatch(db, [{ event, parameters }]);
}

interface Recorded {
    event: LoggedEvent;
    parameters: ConfigurationParameter[];
}

/** Several events and their rollups in one batch, so none lands without the rest. */
async function recordBatch(db: Db, recorded: Recorded[]): Promise<void> {
    if (recorded.length === 0) return;
    const writes: BatchItem<"sqlite">[] = recorded.flatMap(
        ({ event, parameters }) => [
            db.insert(events).values(event),
            ...rollupWrites(db, event, parameters)
        ]
    );

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

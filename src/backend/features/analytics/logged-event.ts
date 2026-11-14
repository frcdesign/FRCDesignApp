/** The one place that knows which columns each kind of event sets. */
import { type LibraryId } from "../library/library-id";
import type {
    VersionJobKind,
    VersionJobOutcome
} from "../version-manager/contract";
import type {
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic
} from "../feedback/contract";
import { EventType, UseTarget, type UseSource } from "./usage";
import { type LoggedEvent } from "./schema";

/** What every event carries, whatever kind of event it is. */
export type EventCore = Pick<
    LoggedEvent,
    | "id"
    | "type"
    | "createdAt"
    | "day"
    | "libraryId"
    | "userId"
    | "schemaVersion"
>;

/** What only a version run fills in. */
type VersionRunColumns = Pick<
    LoggedEvent,
    | "versionKind"
    | "versionScope"
    | "versionUpdateOnly"
    | "versionOutcome"
    | "failedSteps"
    | "createdVersions"
    | "updatedElements"
>;

/** What only a report fills in. */
type ReportColumns = Pick<
    LoggedEvent,
    "reportTopic" | "reportCategory" | "reportSource" | "reportTeamNumber"
>;

/** The part a use or a part report named. */
export type ElementColumns = Pick<
    LoggedEvent,
    "elementId" | "documentId" | "instanceId" | "instanceType" | "insertableId"
>;

/** A FeatureScript's constant: an add's, beside its studio's element columns, or a report's that names one. */
type FeatureAddColumns = Pick<LoggedEvent, "featureType">;

/** What only a use, an insert or a download, fills in. */
type UseColumns = Omit<
    LoggedEvent,
    | keyof EventCore
    | keyof VersionRunColumns
    | keyof ReportColumns
    | keyof ElementColumns
    | keyof FeatureAddColumns
>;

/** Spelled out, so a new column fails to compile until someone decides its value here. */
export const NOT_A_USE: UseColumns = {
    targetElementType: null,
    selection: null,
    isFavorite: null,
    isQuickInsert: null,
    source: null,
    fasten: null
};

export const NO_ELEMENT: ElementColumns = {
    elementId: null,
    documentId: null,
    instanceId: null,
    instanceType: null,
    insertableId: null
};

export const NOT_A_VERSION_RUN: VersionRunColumns = {
    versionKind: null,
    versionScope: null,
    versionUpdateOnly: null,
    versionOutcome: null,
    failedSteps: null,
    createdVersions: null,
    updatedElements: null
};

export const NOT_A_FEATURE_ADD: FeatureAddColumns = {
    featureType: null
};

/** A logged FeatureScript add, whose feature a reader can then count on. */
export type LoggedFeatureAdd = LoggedEvent & { featureType: string };

/** Undefined for another kind of event. */
export function asFeatureAdd(event: LoggedEvent): LoggedFeatureAdd | undefined {
    const isAdd =
        event.type === EventType.FEATURE_ADD && event.featureType !== null;
    return isAdd ? (event as LoggedFeatureAdd) : undefined;
}

export const NOT_A_REPORT: ReportColumns = {
    reportTopic: null,
    reportCategory: null,
    reportSource: null,
    reportTeamNumber: null
};

/** A logged run, whose own columns a reader can then count on. */
export type LoggedVersionRun = LoggedEvent & {
    versionKind: VersionJobKind;
    versionUpdateOnly: boolean;
    versionOutcome: VersionJobOutcome;
    failedSteps: number;
    createdVersions: number;
    updatedElements: number;
};

/** Undefined for another kind of event. */
export function asVersionRun(event: LoggedEvent): LoggedVersionRun | undefined {
    const isRun =
        event.type === EventType.VERSION_RUN && event.versionKind !== null;
    return isRun ? (event as LoggedVersionRun) : undefined;
}

/** A logged insert or download, whose own columns a reader can then count on. */
export type LoggedUse = LoggedEvent & {
    /** A use is always from a library, whatever the column allows. */
    libraryId: LibraryId;
    elementId: string;
    source: UseSource;
    /** Where the part went, which the rollups split by. */
    target: UseTarget;
};

/** Undefined for another kind, or an insert from a version that didn't set these columns. */
export function asUse(event: LoggedEvent): LoggedUse | undefined {
    const target = targetOf(event);
    const isUse =
        target !== undefined &&
        event.libraryId !== null &&
        event.elementId !== null &&
        event.source !== null;
    return isUse ? ({ ...event, target } as LoggedUse) : undefined;
}

function targetOf(event: LoggedEvent): UseTarget | undefined {
    switch (event.type) {
        case EventType.DOWNLOAD:
            return UseTarget.DOWNLOAD;
        case EventType.INSERT:
            // The two enums share their values.
            return (event.targetElementType ?? undefined) as
                | UseTarget
                | undefined;
        default:
            return undefined;
    }
}

/** A logged report, whose own columns a reader can then count on. */
export type LoggedReport = LoggedEvent & {
    reportTopic: FeedbackTopic;
    reportCategory: FeedbackCategory;
    reportSource: FeedbackSource;
};

/** Undefined for another kind of event. */
export function asReport(event: LoggedEvent): LoggedReport | undefined {
    const isReport =
        event.type === EventType.REPORT &&
        event.reportTopic !== null &&
        event.reportCategory !== null &&
        event.reportSource !== null;
    return isReport ? (event as LoggedReport) : undefined;
}

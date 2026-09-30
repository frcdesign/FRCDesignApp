/** The one place that knows which columns each kind of event sets. */
import { type ElementType } from "../../lib/onshape/element-type";
import { type LibraryId } from "../library/library-id";
import type {
    VersionJobKind,
    VersionJobOutcome
} from "../version-manager/contract";
import { EventType, type InsertSource } from "./usage";
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

/** What only an insert fills in. */
type InsertColumns = Omit<
    LoggedEvent,
    keyof EventCore | keyof VersionRunColumns
>;

/** Spelled out, so a new column fails to compile until someone decides its value here. */
export const NOT_AN_INSERT: InsertColumns = {
    elementId: null,
    documentId: null,
    instanceId: null,
    instanceType: null,
    insertableId: null,
    targetElementType: null,
    selection: null,
    isFavorite: null,
    isQuickInsert: null,
    source: null,
    fasten: null
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

/** A logged insert, whose own columns a reader can then count on. */
export type LoggedInsert = LoggedEvent & {
    /** An insert is always from a library, whatever the column allows. */
    libraryId: LibraryId;
    elementId: string;
    targetElementType: ElementType;
    source: InsertSource;
};

/** Undefined for another kind, or an insert from a version that didn't set these columns. */
export function asInsert(event: LoggedEvent): LoggedInsert | undefined {
    const isInsert =
        event.type === EventType.INSERT &&
        event.libraryId !== null &&
        event.elementId !== null &&
        event.targetElementType !== null &&
        event.source !== null;
    return isInsert ? (event as LoggedInsert) : undefined;
}

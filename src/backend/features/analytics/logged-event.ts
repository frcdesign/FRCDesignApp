/**
 * The log's rows, read as the events they are. `events` is one wide table, so
 * this is the one place that knows which columns a given kind sets.
 */
import { type ElementType } from "../../lib/onshape/element-type";
import { EventType, type InsertSource } from "./events";
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

/** The rest, which only an insert fills in. */
export type InsertColumns = Omit<LoggedEvent, keyof EventCore>;

/**
 * Spelled out rather than defaulted: a column added to the log stops compiling
 * here until someone says what a non-insert records for it.
 */
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

/** A logged insert, whose own columns a reader can then count on. */
export type LoggedInsert = LoggedEvent & {
    elementId: string;
    targetElementType: ElementType;
    source: InsertSource;
};

/**
 * Null for another kind, and for an insert whose columns disagree with its type —
 * a row from a version that did not set them, worth reading past not crashing on.
 */
export function asInsert(event: LoggedEvent): LoggedInsert | null {
    const isInsert =
        event.type === EventType.INSERT &&
        event.elementId !== null &&
        event.targetElementType !== null &&
        event.source !== null;
    return isInsert ? (event as LoggedInsert) : null;
}

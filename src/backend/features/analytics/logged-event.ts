/**
 * The log's rows, read as the events they are.
 *
 * `events` is one wide table covering every kind of event, so most of its
 * columns are nullable and only some are set for any given row. This is the one
 * place that knows which: what a non-insert writes, and what a reader may count
 * on having once a row turns out to be an insert.
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
 * The insert-only columns an app open leaves empty, spelled out rather than
 * defaulted: a column added to the log stops compiling here until someone says
 * what a non-insert should record for it.
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
 * The row as an insert, or null when it is some other kind. Also null for an
 * insert whose columns disagree with its type — a row written by a version that
 * did not set them yet, which is worth reading past rather than crashing on.
 */
export function asInsert(event: LoggedEvent): LoggedInsert | null {
    const isInsert =
        event.type === EventType.INSERT &&
        event.elementId !== null &&
        event.targetElementType !== null &&
        event.source !== null;
    return isInsert ? (event as LoggedInsert) : null;
}

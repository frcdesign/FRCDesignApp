/** The one place that knows which columns each kind of event sets. */
import { type ElementType } from "../../lib/onshape/element-type";
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

/** The rest, which only an insert fills in. */
type InsertColumns = Omit<LoggedEvent, keyof EventCore>;

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

/** A logged insert, whose own columns a reader can then count on. */
export type LoggedInsert = LoggedEvent & {
    elementId: string;
    targetElementType: ElementType;
    source: InsertSource;
};

/** Undefined for another kind, or an insert from a version that didn't set these columns. */
export function asInsert(event: LoggedEvent): LoggedInsert | undefined {
    const isInsert =
        event.type === EventType.INSERT &&
        event.elementId !== null &&
        event.targetElementType !== null &&
        event.source !== null;
    return isInsert ? (event as LoggedInsert) : undefined;
}

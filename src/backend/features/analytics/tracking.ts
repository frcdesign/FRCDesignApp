import type { BatchItem } from "drizzle-orm/batch";
import { runInBackground } from "../../lib/background";
import { type AppContext } from "../../lib/context";
import { getDb } from "../../db/client";
import { events, type LoggedEvent } from "./schema";
import { NOT_AN_INSERT, type EventCore } from "./logged-event";
import { rollupWrites } from "./rollups";
import { EVENT_SCHEMA_VERSION, EventType, InsertSource } from "./usage";
import { type LibraryId } from "../library/library-id";
import { type ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { canonicalValues } from "../configurations/selection";
import { toDayKey } from "./day";

/** The caller is the one who inserted; see `trackInsert`. */
export interface InsertEvent {
    libraryId: LibraryId;
    /** The rollups key on the element id; the rest records the version. */
    path: ElementPath;
    insertableId: string;
    /** The type of tab the user inserted into. */
    targetElementType: ElementType;
    /** The whole selection the insert applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Passed in, since the insert already loaded them. */
    parameters: ConfigurationParameter[];
    /** Whether the part was favorited, not where the insert came from. */
    isFavorite: boolean;
    isQuickInsert: boolean;
    source: InsertSource;
    fasten: boolean;
}

/** After the response, and never failing it: tracking is not what was asked for. */
export function trackInsert(c: AppContext, event: InsertEvent): Promise<void> {
    return runInBackground(c, "record an insert", async () =>
        record(c, {
            ...(await core(c, EventType.INSERT, event.libraryId)),
            ...event.path,
            insertableId: event.insertableId,
            targetElementType: event.targetElementType,
            selection: appliedSelection(event.selection, event.parameters),
            isFavorite: event.isFavorite,
            isQuickInsert: event.isQuickInsert,
            source: event.source,
            fasten: event.fasten
        })
    );
}

/** As `trackInsert`. */
export function trackAppOpen(
    c: AppContext,
    libraryId: LibraryId
): Promise<void> {
    return runInBackground(c, "record an app open", async () =>
        record(c, {
            ...(await core(c, EventType.APP_OPEN, libraryId)),
            ...NOT_AN_INSERT
        })
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
async function core(
    c: AppContext,
    type: EventType,
    libraryId: LibraryId
): Promise<EventCore> {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        type,
        createdAt: new Date(now),
        day: toDayKey(now),
        libraryId,
        userId: await c.var.getUserId(),
        schemaVersion: EVENT_SCHEMA_VERSION
    };
}

/** Batched so neither half lands without the other. */
async function record(c: AppContext, event: LoggedEvent): Promise<void> {
    const db = getDb(c.env.DB);
    const writes: BatchItem<"sqlite">[] = [
        db.insert(events).values(event),
        ...rollupWrites(db, event)
    ];

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

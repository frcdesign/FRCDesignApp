import type { BatchItem } from "drizzle-orm/batch";
import { type AppContext } from "../../lib/context";
import { getDb, type Db } from "../../db/client";
import { events, type LoggedEvent } from "./schema";
import { NOT_AN_INSERT, type EventCore } from "./logged-event";
import { rollupWrites } from "./rollups";
import { EVENT_SCHEMA_VERSION, EventType, InsertSource } from "./events";
import { type LibraryId } from "../library/library-id";
import { type ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/models";
import { appliedValues } from "../configurations/selection";
import { toDayKey } from "./day";

export interface InsertEvent {
    libraryId: LibraryId;
    userId: string;
    /** The version-pinned tab inserted from, logged whole: the rollups key on
     * its element id, and the rest says which version was used. */
    path: ElementPath;
    insertableId: string;
    /** The type of tab the user inserted into. */
    targetElementType: ElementType;
    /** The whole selection the insert applied; undefined when it has none. */
    selection: Selection | undefined;
    /**
     * The parameters that selection was made whole against, carried rather than
     * read back: applying the insert already had to load them.
     */
    parameters: ConfigurationParameter[];
    /** Whether the part was favorited, not where the insert came from. */
    isFavorite: boolean;
    isQuickInsert: boolean;
    source: InsertSource;
    fasten: boolean;
}

export interface AppOpenEvent {
    libraryId: LibraryId;
    userId: string;
}

/**
 * Usage data is never worth failing a user's insert over, so errors are logged
 * and dropped. Awaits when no execution context is available.
 */
export async function trackInBackground(
    c: AppContext,
    work: () => Promise<void>
): Promise<void> {
    const guarded = work().catch((error) => {
        console.error("Failed to record usage event", error);
    });

    try {
        c.executionCtx.waitUntil(guarded);
    } catch {
        await guarded;
    }
}

export async function trackInsert(
    c: AppContext,
    event: InsertEvent
): Promise<void> {
    const db = getDb(c.env.DB);
    const now = Date.now();

    await record(db, {
        ...core(EventType.INSERT, now, event),
        ...event.path,
        insertableId: event.insertableId,
        targetElementType: event.targetElementType,
        selection: appliedSelection(event.selection, event.parameters),
        isFavorite: event.isFavorite,
        isQuickInsert: event.isQuickInsert,
        source: event.source,
        fasten: event.fasten
    });
}

export async function trackAppOpen(
    c: AppContext,
    event: AppOpenEvent
): Promise<void> {
    const db = getDb(c.env.DB);
    const now = Date.now();

    await record(db, {
        ...core(EventType.APP_OPEN, now, event),
        ...NOT_AN_INSERT
    });
}

/**
 * What Onshape applied for a selection: the values no condition hid. Null when
 * the insertable has nothing to configure, which is what the log records.
 */
function appliedSelection(
    selection: Selection | undefined,
    parameters: ConfigurationParameter[]
): Selection | null {
    if (!selection || parameters.length === 0) return null;
    return appliedValues(selection, parameters);
}

/** What every logged event carries; its kind fills in the rest. */
function core(
    type: EventType,
    now: number,
    event: { libraryId: LibraryId; userId: string }
): EventCore {
    return {
        id: crypto.randomUUID(),
        type,
        createdAt: new Date(now),
        day: toDayKey(now),
        libraryId: event.libraryId,
        userId: event.userId,
        schemaVersion: EVENT_SCHEMA_VERSION
    };
}

/**
 * The two halves of a write, batched so neither lands without the other. Kept
 * apart so the counting can move to a batch job without touching the recording.
 */
async function record(db: Db, event: LoggedEvent): Promise<void> {
    const writes: BatchItem<"sqlite">[] = [
        db.insert(events).values(event),
        ...rollupWrites(db, event)
    ];

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

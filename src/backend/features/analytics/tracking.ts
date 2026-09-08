import type { BatchItem } from "drizzle-orm/batch";
import { type AppContext } from "../../lib/context";
import { getDb, type Db } from "../../db/client";
import {
    events,
    type EventCore,
    type InsertColumns,
    type LoggedEvent
} from "./schema";
import { rollupWrites } from "./rollups";
import { EventType, InsertSource } from "./events";
import { type LibraryId } from "../library/library-id";
import { type ElementPath } from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import { type Selection } from "../configurations/models";
import { appliedSelection } from "../configurations/storage";

/** Formats an epoch timestamp as the UTC `YYYY-MM-DD` day key. */
export function toDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

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
        selection: await appliedSelection(
            db,
            event.insertableId,
            event.selection
        ),
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

/** What every logged event carries; its kind fills in the rest. */
function core(
    type: EventType,
    now: number,
    event: { libraryId: LibraryId; userId: string }
): EventCore {
    return {
        id: crypto.randomUUID(),
        type,
        createdAt: now,
        day: toDayKey(now),
        libraryId: event.libraryId,
        userId: event.userId
    };
}

/**
 * The insert-only columns an app open leaves empty, spelled out rather than
 * defaulted: a column added to the log stops compiling here until someone says
 * what a non-insert should record for it.
 */
const NOT_AN_INSERT: InsertColumns = {
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

/**
 * Appends the event to the log, then applies it to the rollups — the two halves
 * of a write, in one batch so neither can land without the other. They are kept
 * apart so the second can move to a batch job over the log without touching the
 * first: what is recorded and what is counted are separate decisions.
 */
async function record(db: Db, event: LoggedEvent): Promise<void> {
    const writes: BatchItem<"sqlite">[] = [
        db.insert(events).values(event),
        ...rollupWrites(db, event)
    ];

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

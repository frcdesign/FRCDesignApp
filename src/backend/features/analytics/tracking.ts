import { sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type AppContext } from "../../lib/context";
import { getDb, type Db } from "../../db/client";
import {
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyUserActivity,
    events,
    insertableStats,
    userStats
} from "../../db/schema";
import { EventType, InsertSource } from "./events";
import { type LibraryId } from "../library/library-id";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/models";
import { applied } from "../configurations/selection";

/** Formats an epoch timestamp as the UTC `YYYY-MM-DD` day key. */
export function toDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

export interface InsertEvent {
    libraryId: LibraryId;
    userId: string;
    /** Onshape element id — the key analytics is stored against. */
    elementId: string;
    insertableId: string;
    /** The type of tab the user inserted into. */
    targetElementType: ElementType;
    /** The whole selection the insert applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Its parameters, so the hidden ones can be left out of the counts. */
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
 * Runs tracking work without blocking the response, swallowing any failure.
 *
 * Usage data is never worth failing a user's insert over, so errors are logged
 * and dropped. Falls back to awaiting when no execution context is available.
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

/** Records an insert as a raw event plus its rollups, in a single D1 batch. */
export async function trackInsert(
    c: AppContext,
    event: InsertEvent
): Promise<void> {
    const db = getDb(c.env.DB);
    const now = Date.now();
    const day = toDayKey(now);
    // What Onshape actually applied: the selection minus the parameters it
    // hides, which is what a count of chosen values means.
    const selection = event.selection
        ? applied(event.selection, event.parameters)
        : null;

    const writes: BatchItem<"sqlite">[] = [
        db.insert(events).values({
            type: EventType.INSERT,
            createdAt: now,
            day,
            libraryId: event.libraryId,
            userId: event.userId,
            elementId: event.elementId,
            insertableId: event.insertableId,
            targetElementType: event.targetElementType,
            selection,
            isFavorite: event.isFavorite,
            isQuickInsert: event.isQuickInsert,
            source: event.source,
            fasten: event.fasten
        }),
        incrementDailyMetric(db, day, event.libraryId, EventType.INSERT, {
            favorite: event.isFavorite,
            fasten: event.fasten,
            quickInsert: event.isQuickInsert,
            assembly: event.targetElementType === ElementType.ASSEMBLY
        }),
        incrementSourceMetric(db, day, event),
        incrementInsertableMetric(db, day, event),
        markUserActive(db, day, event.libraryId, event.userId),
        markInsertableUserActive(db, day, event),
        db
            .insert(insertableStats)
            .values({
                libraryId: event.libraryId,
                elementId: event.elementId,
                insertCount: 1,
                firstInsertedAt: now,
                lastInsertedAt: now
            })
            .onConflictDoUpdate({
                target: [insertableStats.libraryId, insertableStats.elementId],
                set: {
                    insertCount: sql`${insertableStats.insertCount} + 1`,
                    lastInsertedAt: now
                }
            }),
        db
            .insert(userStats)
            .values({
                userId: event.userId,
                libraryId: event.libraryId,
                insertCount: 1,
                firstSeenAt: now,
                lastSeenAt: now
            })
            .onConflictDoUpdate({
                target: [userStats.userId, userStats.libraryId],
                set: {
                    insertCount: sql`${userStats.insertCount} + 1`,
                    lastSeenAt: now
                }
            }),
        ...configurationWrites(db, day, event, selection)
    ];

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** Records an app open as a raw event plus its rollups. */
export async function trackAppOpen(
    c: AppContext,
    event: AppOpenEvent
): Promise<void> {
    const db = getDb(c.env.DB);
    const now = Date.now();
    const day = toDayKey(now);

    await db.batch([
        db.insert(events).values({
            type: EventType.APP_OPEN,
            createdAt: now,
            day,
            libraryId: event.libraryId,
            userId: event.userId
        }),
        incrementDailyMetric(db, day, event.libraryId, EventType.APP_OPEN),
        markUserActive(db, day, event.libraryId, event.userId),
        db
            .insert(userStats)
            .values({
                userId: event.userId,
                libraryId: event.libraryId,
                openCount: 1,
                firstSeenAt: now,
                lastSeenAt: now
            })
            .onConflictDoUpdate({
                target: [userStats.userId, userStats.libraryId],
                set: {
                    openCount: sql`${userStats.openCount} + 1`,
                    lastSeenAt: now
                }
            })
    ]);
}

/**
 * Records that this user was active today. Idempotent, so the row is written
 * once per user per library per day no matter how much they do.
 */
function markUserActive(
    db: Db,
    day: string,
    libraryId: LibraryId,
    userId: string
) {
    return db
        .insert(dailyUserActivity)
        .values({ day, libraryId, userId })
        .onConflictDoNothing();
}

/** The day's counters for the part itself, including its target split. */
function incrementInsertableMetric(db: Db, day: string, event: InsertEvent) {
    const partStudio =
        event.targetElementType === ElementType.PART_STUDIO ? 1 : 0;
    const assembly = event.targetElementType === ElementType.ASSEMBLY ? 1 : 0;

    return db
        .insert(dailyInsertableMetrics)
        .values({
            day,
            libraryId: event.libraryId,
            elementId: event.elementId,
            count: 1,
            partStudioCount: partStudio,
            assemblyCount: assembly
        })
        .onConflictDoUpdate({
            target: [
                dailyInsertableMetrics.libraryId,
                dailyInsertableMetrics.elementId,
                dailyInsertableMetrics.day
            ],
            set: {
                count: sql`${dailyInsertableMetrics.count} + 1`,
                partStudioCount: sql`${dailyInsertableMetrics.partStudioCount} + ${partStudio}`,
                assemblyCount: sql`${dailyInsertableMetrics.assemblyCount} + ${assembly}`
            }
        });
}

/** As {@link markUserActive}, but for one part rather than the library. */
function markInsertableUserActive(db: Db, day: string, event: InsertEvent) {
    return db
        .insert(dailyInsertableUsers)
        .values({
            day,
            libraryId: event.libraryId,
            elementId: event.elementId,
            userId: event.userId
        })
        .onConflictDoNothing();
}

/** Counters incremented alongside a day's inserts, each a subset of its total. */
interface InsertFlags {
    favorite: boolean;
    fasten: boolean;
    quickInsert: boolean;
    /** Targeted an assembly, so insert-and-fasten was on offer. */
    assembly: boolean;
}

const NO_FLAGS: InsertFlags = {
    favorite: false,
    fasten: false,
    quickInsert: false,
    assembly: false
};

function incrementDailyMetric(
    db: Db,
    day: string,
    libraryId: LibraryId,
    type: EventType,
    flags: InsertFlags = NO_FLAGS
) {
    const favorite = flags.favorite ? 1 : 0;
    const fasten = flags.fasten ? 1 : 0;
    const quickInsert = flags.quickInsert ? 1 : 0;
    const assembly = flags.assembly ? 1 : 0;

    return db
        .insert(dailyMetrics)
        .values({
            day,
            libraryId,
            type,
            count: 1,
            favoriteCount: favorite,
            fastenCount: fasten,
            quickInsertCount: quickInsert,
            assemblyCount: assembly
        })
        .onConflictDoUpdate({
            target: [
                dailyMetrics.day,
                dailyMetrics.libraryId,
                dailyMetrics.type
            ],
            set: {
                count: sql`${dailyMetrics.count} + 1`,
                favoriteCount: sql`${dailyMetrics.favoriteCount} + ${favorite}`,
                fastenCount: sql`${dailyMetrics.fastenCount} + ${fasten}`,
                quickInsertCount: sql`${dailyMetrics.quickInsertCount} + ${quickInsert}`,
                assemblyCount: sql`${dailyMetrics.assemblyCount} + ${assembly}`
            }
        });
}

function incrementSourceMetric(db: Db, day: string, event: InsertEvent) {
    const quickInsert = event.isQuickInsert ? 1 : 0;

    return db
        .insert(dailySourceMetrics)
        .values({
            day,
            libraryId: event.libraryId,
            source: event.source,
            count: 1,
            quickInsertCount: quickInsert
        })
        .onConflictDoUpdate({
            target: [
                dailySourceMetrics.day,
                dailySourceMetrics.libraryId,
                dailySourceMetrics.source
            ],
            set: {
                count: sql`${dailySourceMetrics.count} + 1`,
                quickInsertCount: sql`${dailySourceMetrics.quickInsertCount} + ${quickInsert}`
            }
        });
}

/** One counter per parameter value the insert used. */
function configurationWrites(
    db: Db,
    day: string,
    event: InsertEvent,
    selection: Selection | null
): BatchItem<"sqlite">[] {
    if (!selection) return [];

    return Object.entries(selection).map(([parameterId, value]) =>
        db
            .insert(dailyConfigurationMetrics)
            .values({
                day,
                libraryId: event.libraryId,
                elementId: event.elementId,
                parameterId,
                value,
                count: 1
            })
            .onConflictDoUpdate({
                target: [
                    dailyConfigurationMetrics.libraryId,
                    dailyConfigurationMetrics.elementId,
                    dailyConfigurationMetrics.parameterId,
                    dailyConfigurationMetrics.value,
                    dailyConfigurationMetrics.day
                ],
                set: { count: sql`${dailyConfigurationMetrics.count} + 1` }
            })
    );
}

import { sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Db } from "../../db/client";
import { ElementType } from "../../lib/onshape/element-type";
import { EventType, InsertSource } from "./events";
import {
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    insertableStats,
    userStats,
    type LoggedEvent
} from "./schema";

/** A logged insert, whose own columns a rollup can then count on. */
type LoggedInsert = LoggedEvent & {
    elementId: string;
    targetElementType: ElementType;
    source: InsertSource;
};

function isInsert(event: LoggedEvent): event is LoggedInsert {
    return (
        event.type === EventType.INSERT &&
        event.elementId !== null &&
        event.targetElementType !== null &&
        event.source !== null
    );
}

/**
 * Every counter one logged event feeds. Derived from the row alone — no app
 * table is read here — so replaying the log rebuilds the rollups exactly, which
 * is what lets the aggregation move to a batch job later.
 */
export function rollupWrites(
    db: Db,
    event: LoggedEvent
): BatchItem<"sqlite">[] {
    const writes = [
        countDay(db, event),
        markUserActive(db, event),
        countUser(db, event)
    ];
    if (!isInsert(event)) return writes;

    return [
        ...writes,
        countSource(db, event),
        countTarget(db, event),
        countPartDay(db, event),
        markPartUser(db, event),
        countPartLifetime(db, event),
        ...countValues(db, event)
    ];
}

/** The library's day: each flag counter a subset of the day's total. */
function countDay(db: Db, event: LoggedEvent) {
    const favorite = event.isFavorite ? 1 : 0;
    const fasten = event.fasten ? 1 : 0;
    const quickInsert = event.isQuickInsert ? 1 : 0;

    return db
        .insert(dailyMetrics)
        .values({
            day: event.day,
            libraryId: event.libraryId,
            type: event.type,
            count: 1,
            favoriteCount: favorite,
            fastenCount: fasten,
            quickInsertCount: quickInsert
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
                quickInsertCount: sql`${dailyMetrics.quickInsertCount} + ${quickInsert}`
            }
        });
}

/**
 * Records that this user was active that day. Idempotent, so the row is written
 * once per user per library per day no matter how much they do.
 */
function markUserActive(db: Db, event: LoggedEvent) {
    return db
        .insert(dailyUserActivity)
        .values({
            day: event.day,
            libraryId: event.libraryId,
            userId: event.userId
        })
        .onConflictDoNothing();
}

/** The user's lifetime row, counting inserts and opens apart. */
function countUser(db: Db, event: LoggedEvent) {
    const insert = event.type === EventType.INSERT ? 1 : 0;
    const open = event.type === EventType.APP_OPEN ? 1 : 0;

    return db
        .insert(userStats)
        .values({
            userId: event.userId,
            libraryId: event.libraryId,
            insertCount: insert,
            openCount: open,
            firstSeenAt: event.createdAt,
            lastSeenAt: event.createdAt
        })
        .onConflictDoUpdate({
            target: [userStats.userId, userStats.libraryId],
            set: {
                insertCount: sql`${userStats.insertCount} + ${insert}`,
                openCount: sql`${userStats.openCount} + ${open}`,
                // Bounds rather than assignment: a replay reaches a day in
                // whatever order the log hands it over.
                firstSeenAt: sql`min(${userStats.firstSeenAt}, ${event.createdAt})`,
                lastSeenAt: sql`max(${userStats.lastSeenAt}, ${event.createdAt})`
            }
        });
}

/** Where the insert started, and how many of those used quick insert. */
function countSource(db: Db, event: LoggedInsert) {
    const quickInsert = event.isQuickInsert ? 1 : 0;

    return db
        .insert(dailySourceMetrics)
        .values({
            day: event.day,
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

/** The library's day for the kind of tab this insert landed in. */
function countTarget(db: Db, event: LoggedInsert) {
    return db
        .insert(dailyTargetMetrics)
        .values({
            day: event.day,
            libraryId: event.libraryId,
            targetElementType: event.targetElementType,
            count: 1
        })
        .onConflictDoUpdate({
            target: [
                dailyTargetMetrics.day,
                dailyTargetMetrics.libraryId,
                dailyTargetMetrics.targetElementType
            ],
            set: { count: sql`${dailyTargetMetrics.count} + 1` }
        });
}

/** As {@link countTarget}, but for one part rather than the library. */
function countPartDay(db: Db, event: LoggedInsert) {
    return db
        .insert(dailyInsertableMetrics)
        .values({
            day: event.day,
            libraryId: event.libraryId,
            elementId: event.elementId,
            targetElementType: event.targetElementType,
            count: 1
        })
        .onConflictDoUpdate({
            target: [
                dailyInsertableMetrics.libraryId,
                dailyInsertableMetrics.elementId,
                dailyInsertableMetrics.day,
                dailyInsertableMetrics.targetElementType
            ],
            set: { count: sql`${dailyInsertableMetrics.count} + 1` }
        });
}

/** As {@link markUserActive}, but for one part rather than the library. */
function markPartUser(db: Db, event: LoggedInsert) {
    return db
        .insert(dailyInsertableUsers)
        .values({
            day: event.day,
            libraryId: event.libraryId,
            elementId: event.elementId,
            userId: event.userId
        })
        .onConflictDoNothing();
}

function countPartLifetime(db: Db, event: LoggedInsert) {
    return db
        .insert(insertableStats)
        .values({
            libraryId: event.libraryId,
            elementId: event.elementId,
            insertCount: 1,
            firstInsertedAt: event.createdAt,
            lastInsertedAt: event.createdAt
        })
        .onConflictDoUpdate({
            target: [insertableStats.libraryId, insertableStats.elementId],
            set: {
                insertCount: sql`${insertableStats.insertCount} + 1`,
                firstInsertedAt: sql`min(${insertableStats.firstInsertedAt}, ${event.createdAt})`,
                lastInsertedAt: sql`max(${insertableStats.lastInsertedAt}, ${event.createdAt})`
            }
        });
}

/** One counter per parameter value the insert applied. */
function countValues(db: Db, event: LoggedInsert): BatchItem<"sqlite">[] {
    if (!event.selection) return [];

    return Object.entries(event.selection).map(([parameterId, value]) =>
        db
            .insert(dailyConfigurationMetrics)
            .values({
                day: event.day,
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

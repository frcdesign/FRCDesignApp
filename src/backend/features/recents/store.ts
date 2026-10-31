import { and, desc, eq, notInArray } from "drizzle-orm";
import { getDb, type Db } from "../../db/client";
import { recentInserts } from "../../db/schema";
import { type AppContext } from "../../lib/context";
import { type LibraryId } from "../library/library-id";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { toRowSelection } from "../configurations/stored-selections";
import { MAX_RECENTS } from "./contract";

export interface RecentInsertEvent {
    libraryId: LibraryId;
    insertableId: string;
    /** The whole selection the insert applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Passed in, since the insert already loaded them. */
    parameters: ConfigurationParameter[];
}

/**
 * Awaited, so the client's refetch after the insert sees it, but never thrown:
 * the part is already in the user's document.
 */
export async function recordRecentInsert(
    c: AppContext,
    event: RecentInsertEvent
): Promise<void> {
    try {
        await writeRecentInsert(
            getDb(c.env.DB),
            await c.var.getUserId(),
            event,
            new Date()
        );
    } catch (error) {
        console.error("Failed to record a recent insert", error);
    }
}

/** Moves the insertable to the front, then drops what falls past {@link MAX_RECENTS}. */
export async function writeRecentInsert(
    db: Db,
    userId: string,
    event: RecentInsertEvent,
    insertedAt: Date
): Promise<void> {
    const { libraryId, insertableId, parameters } = event;
    const selection = event.selection
        ? toRowSelection(event.selection, parameters)
        : null;
    const kept = db
        .select({ insertableId: recentInserts.insertableId })
        .from(recentInserts)
        .where(ofUserInLibrary(userId, libraryId))
        .orderBy(desc(recentInserts.insertedAt))
        .limit(MAX_RECENTS);
    await db.batch([
        db
            .insert(recentInserts)
            .values({ userId, libraryId, insertableId, selection, insertedAt })
            .onConflictDoUpdate({
                target: [recentInserts.userId, recentInserts.insertableId],
                set: { selection, insertedAt }
            }),
        db
            .delete(recentInserts)
            .where(
                and(
                    ofUserInLibrary(userId, libraryId),
                    notInArray(recentInserts.insertableId, kept)
                )
            )
    ]);
}

export function ofUserInLibrary(userId: string, libraryId: LibraryId) {
    return and(
        eq(recentInserts.userId, userId),
        eq(recentInserts.libraryId, libraryId)
    );
}

import { and, desc, eq, notInArray } from "drizzle-orm";
import { getDb, type Db } from "../../db/client";
import { recentInserts } from "../../db/schema";
import { type AppContext } from "../../lib/context";
import { type LibraryId } from "../library/library-id";
import {
    type ConfigurationParameter,
    type Selection
} from "../configurations/contract";
import { toStoredSelection } from "../configurations/selection";
import { MAX_RECENTS } from "./contract";
import { creditedTeamId } from "../teams/context";
import { writeTeamRecentInsert } from "../teams/recents";

export interface RecentInsertEvent {
    libraryId: LibraryId;
    insertableId: string;
    /** The whole selection the insert applied; undefined when it has none. */
    selection: Selection | undefined;
    /** Passed in, since the insert already loaded them. */
    parameters: ConfigurationParameter[];
}

export interface RecordedInsert extends RecentInsertEvent {
    /** The document inserted into, which decides the team whose recents it joins. */
    targetDocumentId: string;
}

/**
 * Awaited, so the client's refetch after the insert sees it, but never thrown:
 * the part is already in the user's document.
 */
export async function recordRecentInsert(
    c: AppContext,
    event: RecordedInsert
): Promise<void> {
    try {
        const db = getDb(c.env.DB);
        const userId = await c.var.getUserId();
        const insertedAt = new Date();
        await writeRecentInsert(db, userId, event, insertedAt);
        const teamId = await creditedTeamId(
            c.env,
            userId,
            event.targetDocumentId
        );
        if (teamId) {
            await writeTeamRecentInsert(db, teamId, userId, event, insertedAt);
        }
    } catch (error) {
        console.error("Failed to record a recent insert", error);
    }
}

/** Moves the configuration to the front, then drops what falls past {@link MAX_RECENTS}. */
export async function writeRecentInsert(
    db: Db,
    userId: string,
    event: RecentInsertEvent,
    insertedAt: Date
): Promise<void> {
    const { libraryId, insertableId, parameters } = event;
    const selection = toStoredSelection(event.selection ?? {}, parameters);
    const kept = db
        .select({ id: recentInserts.id })
        .from(recentInserts)
        .where(ofUserInLibrary(userId, libraryId))
        .orderBy(desc(recentInserts.insertedAt))
        .limit(MAX_RECENTS);
    await db.batch([
        db
            .insert(recentInserts)
            .values({ userId, libraryId, insertableId, selection, insertedAt })
            .onConflictDoUpdate({
                target: [
                    recentInserts.userId,
                    recentInserts.insertableId,
                    recentInserts.selection
                ],
                set: { insertedAt }
            }),
        db
            .delete(recentInserts)
            .where(
                and(
                    ofUserInLibrary(userId, libraryId),
                    notInArray(recentInserts.id, kept)
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

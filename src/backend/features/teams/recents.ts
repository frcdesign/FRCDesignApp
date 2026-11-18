/** What a team's members inserted in its context: a user's recents' shape, shared by the team. */
import { and, desc, eq, notInArray } from "drizzle-orm";
import { type Db } from "../../db/client";
import { teamRecentInserts } from "../../db/schema";
import { type LibraryId } from "../library/library-id";
import { toStoredSelection } from "../configurations/selection";
import {
    getInsertableConfigurations,
    resolveStoredSelection
} from "../configurations/stored-selections";
import { type RecentInsertEvent } from "../recents/store";
import { type RecentInsert, type RecentsData } from "../recents/contract";
import { MAX_TEAM_RECENTS } from "./contract";

function ofTeamInLibrary(teamId: string, libraryId: LibraryId) {
    return and(
        eq(teamRecentInserts.teamId, teamId),
        eq(teamRecentInserts.libraryId, libraryId)
    );
}

/** As a user's: moves the configuration to the front, then trims to `MAX_TEAM_RECENTS`. */
export async function writeTeamRecentInsert(
    db: Db,
    teamId: string,
    userId: string,
    event: RecentInsertEvent,
    insertedAt: Date
): Promise<void> {
    const { libraryId, insertableId, parameters } = event;
    const selection = toStoredSelection(event.selection ?? {}, parameters);
    const kept = db
        .select({ id: teamRecentInserts.id })
        .from(teamRecentInserts)
        .where(ofTeamInLibrary(teamId, libraryId))
        .orderBy(desc(teamRecentInserts.insertedAt))
        .limit(MAX_TEAM_RECENTS);
    await db.batch([
        db
            .insert(teamRecentInserts)
            .values({
                teamId,
                libraryId,
                insertableId,
                selection,
                userId,
                insertedAt
            })
            .onConflictDoUpdate({
                target: [
                    teamRecentInserts.teamId,
                    teamRecentInserts.insertableId,
                    teamRecentInserts.selection
                ],
                set: { insertedAt, userId }
            }),
        db
            .delete(teamRecentInserts)
            .where(
                and(
                    ofTeamInLibrary(teamId, libraryId),
                    notInArray(teamRecentInserts.id, kept)
                )
            )
    ]);
}

export async function getTeamRecents(
    db: Db,
    teamId: string,
    libraryId: LibraryId
): Promise<RecentsData> {
    const rows = await db
        .select()
        .from(teamRecentInserts)
        .where(ofTeamInLibrary(teamId, libraryId))
        .orderBy(desc(teamRecentInserts.insertedAt))
        .limit(MAX_TEAM_RECENTS)
        .all();
    const configurationsById = await getInsertableConfigurations(
        db,
        rows.map((row) => row.insertableId)
    );
    return {
        recents: rows.map(
            (row): RecentInsert => ({
                id: row.id,
                insertableId: row.insertableId,
                ...resolveStoredSelection(
                    Object.keys(row.selection).length > 0
                        ? row.selection
                        : undefined,
                    configurationsById.get(row.insertableId)
                ),
                insertedAt: row.insertedAt.getTime()
            })
        )
    };
}

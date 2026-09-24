/**
 * Keeps a library's stored admin team in step with Onshape's. Access is read
 * from what is stored, so a sync is what changes anyone's access; it is
 * announced as a new library version, which already has every open client
 * refresh what it shows, access included.
 */
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { adminTeamMembers, libraries } from "../../db/schema";
import type { OnshapeApi } from "../../lib/onshape/client";
import { getTeamMembers } from "../../lib/onshape/endpoints/teams";
import { bumpLibraryVersion } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushLibraryChanged } from "../live/notify";

/** Three columns a row, under D1's 100 bound parameters a statement. */
const ROWS_PER_INSERT = 30;

export async function syncAdminTeam(
    env: AppBindings,
    onshapeApi: OnshapeApi,
    libraryId: LibraryId
): Promise<void> {
    const db = getDb(env.DB);
    const library = await db
        .select({ adminTeamId: libraries.adminTeamId })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();
    const teamId = library?.adminTeamId;
    const members = teamId ? await getTeamMembers(onshapeApi, teamId) : [];

    const rows = members.map((member) => ({
        libraryId,
        userId: member.member.id,
        isTeamAdmin: member.admin
    }));
    // Replaced whole, in one batch, so nobody reads a team half written.
    const writes: BatchItem<"sqlite">[] = [
        db
            .delete(adminTeamMembers)
            .where(eq(adminTeamMembers.libraryId, libraryId))
    ];
    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
        writes.push(
            db
                .insert(adminTeamMembers)
                .values(rows.slice(i, i + ROWS_PER_INSERT))
                .onConflictDoNothing()
        );
    }
    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

    await bumpLibraryVersion(db, libraryId);
    await pushLibraryChanged(env, libraryId);
}

/** Every library a team administers, for when that team changes. */
export async function librariesOfTeam(
    env: AppBindings,
    teamId: string
): Promise<LibraryId[]> {
    const rows = await getDb(env.DB)
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.adminTeamId, teamId));
    return rows.map((row) => row.id);
}

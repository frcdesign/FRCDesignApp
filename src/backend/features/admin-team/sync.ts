/** Access is read from the stored team, and a sync bumps the library version so clients refresh. */
import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { libraries } from "../../db/schema";
import type { OnshapeApi } from "../../lib/onshape/client";
import { getTeamMembers } from "../../lib/onshape/endpoints/teams";
import { bumpLibraryVersion } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushLibraryChanged } from "../push/notify";
import { getBackgroundOnshapeApi } from "../auth/background-sessions";

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

    await db
        .update(libraries)
        .set({
            adminTeam: members.map((member) => ({
                userId: member.member.id,
                isTeamAdmin: member.admin
            }))
        })
        .where(eq(libraries.id, libraryId));

    await bumpLibraryVersion(db, libraryId);
    await pushLibraryChanged(env, libraryId);
}

/** Every library whose admin team it is, after Onshape says the team's members changed. */
export async function syncTeamLibraries(
    env: AppBindings,
    teamId: string
): Promise<void> {
    const rows = await getDb(env.DB)
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.adminTeamId, teamId));
    const libraryIds = rows.map((row) => row.id);
    if (libraryIds.length === 0) {
        return;
    }
    const onshapeApi = await getBackgroundOnshapeApi(env, libraryIds);
    if (!onshapeApi) {
        console.warn(`No session to sync team ${teamId} with`);
        return;
    }
    for (const libraryId of libraryIds) {
        await syncAdminTeam(env, onshapeApi, libraryId);
    }
}

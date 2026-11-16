import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { libraries } from "../../db/schema";
import type { AppBindings } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import type { LibraryId } from "../library/library-id";
import type { AdminTeamMember } from "./contract";

/** A copy of `libraries.adminTeam`, so an access check reads no D1 and survives D1 failing. */
const adminTeamCache = kvStore<AdminTeamMember[]>("admin-team", {
    // Bounds how long a write that skipped the cache can be wrong.
    ttlSeconds: 60 * 60
});

/** The library's admin team as last synced; KV lags a sync by up to a minute. */
export async function getAdminTeam(
    env: AppBindings,
    libraryId: LibraryId
): Promise<AdminTeamMember[]> {
    const cached = await adminTeamCache.get(env.KV, libraryId);
    if (cached) return cached;

    const library = await getDb(env.DB)
        .select({ adminTeam: libraries.adminTeam })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();
    const adminTeam = library?.adminTeam ?? [];
    await adminTeamCache.put(env.KV, libraryId, adminTeam);
    return adminTeam;
}

/** The only write of a library's members, so D1 and the cache change together. */
export async function saveAdminTeam(
    env: AppBindings,
    libraryId: LibraryId,
    adminTeam: AdminTeamMember[]
): Promise<void> {
    await getDb(env.DB)
        .update(libraries)
        .set({ adminTeam })
        .where(eq(libraries.id, libraryId));
    await adminTeamCache.put(env.KV, libraryId, adminTeam);
}

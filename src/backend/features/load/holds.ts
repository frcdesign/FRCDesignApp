/**
 * A webhook's new version waits on the group, as `held_at`, until an editor
 * approves it; nothing runs meanwhile. A load that reads the latest version
 * after the hold was set covers it, so it releases the hold.
 */
import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { type Db, getDb } from "../../db/client";
import { groups } from "../../db/schema";
import type { LibraryId } from "../library/library-id";
import { publishLibraries } from "./flag";
import { requestReload } from "./jobs";

/** Holds every group of the document, in whichever libraries have it. */
export async function holdNewVersion(
    env: AppBindings,
    documentId: string
): Promise<void> {
    const held = await getDb(env.DB)
        .update(groups)
        .set({ heldAt: new Date() })
        .where(eq(groups.documentId, documentId))
        .returning({ libraryId: groups.libraryId });
    await publishLibraries(
        env,
        held.map((row) => row.libraryId)
    );
}

/**
 * Releases the hold if it was set before `readAt`, when the load read the
 * latest version; a later one may name a version the load missed.
 */
export function releaseHold(db: Db, groupId: string, readAt: number) {
    return db
        .update(groups)
        .set({ heldAt: null })
        .where(
            and(eq(groups.id, groupId), lte(groups.heldAt, new Date(readAt)))
        )
        .returning({ id: groups.id });
}

/** Reloads the library's held groups as the approver. Returns how many. */
export async function approveHeldVersions(
    env: AppBindings,
    libraryId: LibraryId,
    sessionId: string | undefined
): Promise<number> {
    const rows = await getDb(env.DB)
        .select({ groupId: groups.id })
        .from(groups)
        .where(and(eq(groups.libraryId, libraryId), isNotNull(groups.heldAt)));
    const groupIds = rows.map((row) => row.groupId);
    await requestReload(env, {
        libraryId,
        groupIds,
        sessionId,
        forceReload: false
    });
    return groupIds.length;
}

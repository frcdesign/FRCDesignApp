/**
 * A webhook's new version waits on the group, as `held_at`, until an editor
 * approves it; nothing runs meanwhile. A load that reads the latest version
 * after the hold was set covers it, so it releases the hold. A library that
 * doesn't hold new versions loads them at once.
 */
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { type Db, getDb } from "../../db/client";
import { groups, libraries } from "../../db/schema";
import type { LibraryId } from "../library/library-id";
import { publishLibraries } from "./flag";
import { requestReload } from "./jobs";

/**
 * Holds the document's groups in the libraries that hold new versions, and
 * reloads them in the rest. Nobody is signed in behind a webhook, so each
 * reload borrows an admin's session.
 */
export async function receiveNewVersion(
    env: AppBindings,
    documentId: string
): Promise<void> {
    const db = getDb(env.DB);
    // One group per library at most: a document is added to a library once.
    const rows = await db
        .select({
            groupId: groups.id,
            libraryId: groups.libraryId,
            holdNewVersions: libraries.holdNewVersions
        })
        .from(groups)
        .innerJoin(libraries, eq(groups.libraryId, libraries.id))
        .where(eq(groups.documentId, documentId));

    const held = rows.filter((row) => row.holdNewVersions);
    if (held.length > 0) {
        await db
            .update(groups)
            .set({ heldAt: new Date() })
            .where(
                inArray(
                    groups.id,
                    held.map((row) => row.groupId)
                )
            );
        await publishLibraries(
            env,
            held.map((row) => row.libraryId)
        );
    }
    for (const row of rows.filter((each) => !each.holdNewVersions)) {
        await requestReload(env, {
            libraryId: row.libraryId,
            groupIds: [row.groupId],
            forceReload: false
        });
    }
}

export async function getHoldNewVersions(
    db: Db,
    libraryId: LibraryId
): Promise<boolean> {
    const row = await db
        .select({ holdNewVersions: libraries.holdNewVersions })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();
    // A library with no row yet takes the column's default.
    return row?.holdNewVersions ?? true;
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

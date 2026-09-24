import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { bumpLibraryVersion } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushLibraryChanged } from "../live/notify";
import { addBuildIssue, BuildIssueType } from "../build-checker/issues";

/** A load that did not happen, which an admin has to rerun by reloading. */
export type LoadFailure =
    | BuildIssueType.LOAD_FAILED
    | BuildIssueType.VERSION_NOT_LOADED;

/** Adds the issue to each group; publishing the change is the caller's. */
export async function flagGroups(
    env: AppBindings,
    groupIds: string[],
    type: LoadFailure
): Promise<void> {
    const db = getDb(env.DB);
    for (const groupId of groupIds) {
        const row = await db
            .select({ buildIssues: groups.buildIssues })
            .from(groups)
            .where(eq(groups.id, groupId))
            .get();
        if (row) {
            await db
                .update(groups)
                .set({ buildIssues: addBuildIssue(row.buildIssues, { type }) })
                .where(eq(groups.id, groupId));
        }
    }
}

/** For a flag raised outside a load, which would otherwise publish it. */
export async function publishLibraries(
    env: AppBindings,
    libraryIds: Iterable<LibraryId>
): Promise<void> {
    const db = getDb(env.DB);
    for (const libraryId of new Set(libraryIds)) {
        await bumpLibraryVersion(db, libraryId);
        await pushLibraryChanged(env, libraryId);
    }
}

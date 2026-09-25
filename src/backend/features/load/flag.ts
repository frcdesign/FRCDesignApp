import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { bumpLibraryVersion } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushLibraryChanged } from "../push/notify";
import { addBuildIssue, BuildIssueType } from "../build-checker/issues";

/** Marks each group for an admin to reload; publishing the change is the caller's. */
export async function flagFailedLoads(
    env: AppBindings,
    groupIds: string[]
): Promise<void> {
    const type = BuildIssueType.LOAD_FAILED;
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

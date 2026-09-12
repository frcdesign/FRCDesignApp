/**
 * Where a thumbnail's urls land once the renderer has them.
 *
 * A load queues its thumbnails and does not wait — Onshape renders one per user
 * at a time, so a library's worth of them takes far longer than a load should —
 * which leaves the renderer as the only thing that knows how each one ended.
 */
import { eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import {
    addBuildIssue,
    type BuildIssue,
    BuildIssueType,
    clearBuildIssue
} from "../build-checker/issues";
import type { LibraryId } from "../library/library-id";
import type { ThumbnailUrls } from "./contract";

/** The row a thumbnail belongs to, and the library whose version it bumps. */
export type ThumbnailOwner =
    | { kind: "insertable"; libraryId: LibraryId; insertableId: string }
    | { kind: "group"; libraryId: LibraryId; groupId: string };

/** How a render ended, which is the difference between waiting and broken. */
export type RenderOutcome =
    | { stored: true; urls: ThumbnailUrls }
    | { stored: false };

function resolveIssues(
    existing: BuildIssue[],
    outcome: RenderOutcome
): BuildIssue[] {
    const cleared = clearBuildIssue(
        existing,
        BuildIssueType.THUMBNAIL_PENDING,
        BuildIssueType.THUMBNAIL_FAILED
    );
    return outcome.stored
        ? cleared
        : addBuildIssue(cleared, { type: BuildIssueType.THUMBNAIL_FAILED });
}

/**
 * Writes the outcome onto the row that asked for it. Returns whether anything
 * changed, since a row deleted by a reload in the meantime is not an error —
 * the render simply outlived what wanted it.
 */
export async function recordThumbnailOutcome(
    db: Db,
    owner: ThumbnailOwner,
    outcome: RenderOutcome
): Promise<boolean> {
    const urls = outcome.stored ? outcome.urls : null;

    if (owner.kind === "insertable") {
        const row = await db
            .select({ buildIssues: insertables.buildIssues })
            .from(insertables)
            .where(eq(insertables.id, owner.insertableId))
            .get();
        if (!row) return false;

        await db
            .update(insertables)
            .set({
                smallThumbnailUrl: urls?.small ?? null,
                largeThumbnailUrl: urls?.large ?? null,
                buildIssues: resolveIssues(row.buildIssues, outcome)
            })
            .where(eq(insertables.id, owner.insertableId));
        return true;
    }

    const row = await db
        .select({ buildIssues: groups.buildIssues })
        .from(groups)
        .where(eq(groups.id, owner.groupId))
        .get();
    if (!row) return false;

    await db
        .update(groups)
        .set({
            smallThumbnailUrl: urls?.small ?? null,
            largeThumbnailUrl: urls?.large ?? null,
            buildIssues: resolveIssues(row.buildIssues, outcome)
        })
        .where(eq(groups.id, owner.groupId));
    return true;
}

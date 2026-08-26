import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Db } from "../../db/client";
import { configurations, group, insertables } from "../../db/schema";
import {
    addBuildIssue,
    BuildIssueType,
    clearBuildIssue,
    type BuildIssue
} from "./issues";
import { checkInsertable, INSERTABLE_CHECK_TYPES } from "./checks";
import { type ThumbnailUrls } from "../thumbnails/types";

/** The pair is stored as two columns but written together, so it is all or nothing. */
function toThumbnailUrls(row: {
    smallThumbnailUrl: string | null;
    largeThumbnailUrl: string | null;
}): ThumbnailUrls | null {
    const { smallThumbnailUrl, largeThumbnailUrl } = row;
    return smallThumbnailUrl === null || largeThumbnailUrl === null
        ? null
        : { small: smallThumbnailUrl, large: largeThumbnailUrl };
}

/**
 * Recomputes the build checks that depend on visibility.
 *
 * Visibility is an editor toggle rather than load output, so without this the
 * stored issues would sit stale until the group next reloaded — which is why
 * the group's check used to be computed in the panel instead. Everything the
 * checks need is already on the rows, so this costs no Onshape calls.
 */
export async function recomputeVisibilityChecks(
    db: Db,
    insertableIds: string[]
): Promise<void> {
    if (insertableIds.length === 0) return;

    const rows = await db
        .select({
            id: insertables.id,
            groupId: insertables.groupId,
            vendors: insertables.vendors,
            smallThumbnailUrl: insertables.smallThumbnailUrl,
            largeThumbnailUrl: insertables.largeThumbnailUrl,
            isVisible: insertables.isVisible,
            buildIssues: insertables.buildIssues,
            // The part-number check reads these, and they outlive a toggle.
            partMetadata: insertables.partMetadata,
            records: configurations.records
        })
        .from(insertables)
        .leftJoin(configurations, eq(configurations.id, insertables.id))
        .where(inArray(insertables.id, insertableIds))
        .all();
    if (rows.length === 0) return;

    const writes: BatchItem<"sqlite">[] = rows.map((row) =>
        db
            .update(insertables)
            .set({
                // Replace only what these checks own, so a load failure or a
                // part-number issue recorded elsewhere survives.
                buildIssues: addBuildIssue(
                    clearBuildIssue(row.buildIssues, ...INSERTABLE_CHECK_TYPES),
                    ...checkInsertable({
                        vendors: row.vendors,
                        thumbnailUrls: toThumbnailUrls(row),
                        isVisible: row.isVisible,
                        probes: [row.partMetadata, ...(row.records ?? [])]
                    })
                )
            })
            .where(eq(insertables.id, row.id))
    );

    const groupIds = [...new Set(rows.map((row) => row.groupId))];
    for (const groupId of groupIds) {
        const buildIssues = await groupVisibilityIssues(db, groupId);
        writes.push(
            db.update(group).set({ buildIssues }).where(eq(group.id, groupId))
        );
    }

    await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/**
 * The group's issues with its "nothing visible" flag brought up to date.
 *
 * Returns the issues rather than the write, because a Drizzle builder returned
 * from an async function would be awaited into a result instead of batched.
 */
async function groupVisibilityIssues(
    db: Db,
    groupId: string
): Promise<BuildIssue[]> {
    const [groupRow, visible] = await Promise.all([
        db
            .select({ buildIssues: group.buildIssues })
            .from(group)
            .where(eq(group.id, groupId))
            .get(),
        db
            .select({ id: insertables.id })
            .from(insertables)
            .where(
                and(
                    eq(insertables.groupId, groupId),
                    eq(insertables.isVisible, true)
                )
            )
            .get()
    ]);

    const cleared = clearBuildIssue(
        groupRow?.buildIssues ?? [],
        BuildIssueType.NO_UNHIDDEN_INSERTABLES
    );
    return visible === undefined
        ? addBuildIssue(cleared, {
              type: BuildIssueType.NO_UNHIDDEN_INSERTABLES
          })
        : cleared;
}

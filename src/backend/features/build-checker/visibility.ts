import { and, eq, max } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import type { LibraryId } from "../library/library-id";
import { checkVisibility } from "./checks";
import { BuildIssueType, hasBuildIssue } from "./issues";

/**
 * Stores `NO_UNHIDDEN_INSERTABLES` on the library's groups after a visibility
 * change. A group with no insertables is left to its load: it either has none
 * to show or never loaded.
 */
export async function recheckVisibility(
    db: Db,
    libraryId: LibraryId
): Promise<void> {
    const [visibility, groupRows] = await Promise.all([
        db
            .select({
                groupId: insertables.groupId,
                hasVisibleInsertable: max(insertables.isVisible)
            })
            .from(insertables)
            .where(eq(insertables.libraryId, libraryId))
            .groupBy(insertables.groupId),
        db
            .select({ id: groups.id, buildIssues: groups.buildIssues })
            .from(groups)
            .where(eq(groups.libraryId, libraryId))
    ]);

    const hasVisibleByGroup = new Map(
        visibility.map((row) => [row.groupId, !!row.hasVisibleInsertable])
    );
    const writes: BatchItem<"sqlite">[] = [];
    for (const group of groupRows) {
        const hasVisibleInsertable = hasVisibleByGroup.get(group.id);
        if (hasVisibleInsertable === undefined) continue;
        const isFlagged = hasBuildIssue(
            group.buildIssues,
            BuildIssueType.NO_UNHIDDEN_INSERTABLES
        );
        if (isFlagged !== hasVisibleInsertable) continue;
        writes.push(
            db
                .update(groups)
                .set({
                    buildIssues: checkVisibility(
                        group.buildIssues,
                        hasVisibleInsertable
                    )
                })
                .where(
                    and(
                        eq(groups.id, group.id),
                        eq(groups.libraryId, libraryId)
                    )
                )
        );
    }
    if (writes.length > 0) {
        await db.batch(
            writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
        );
    }
}

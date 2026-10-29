import { and, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import type { LibraryHealthCounts } from "./contract";
import {
    BuildIssueSeverity,
    getIssueSeverity,
    getMaxSeverity,
    type BuildIssue
} from "../build-checker/issues";

/** Hidden insertables skip the build checks, so they aren't counted at all. */
function visibleIn(libraryId: LibraryId) {
    return and(
        eq(insertables.libraryId, libraryId),
        eq(insertables.isVisible, true)
    );
}

/** Selects only what the counting reads: the issues, and an id to merge on. */
export async function getHealthCounts(
    db: Db,
    libraryId: LibraryId
): Promise<LibraryHealthCounts> {
    const [allGroups, allInsertables] = await Promise.all([
        db
            .select({ buildIssues: groups.buildIssues })
            .from(groups)
            .where(eq(groups.libraryId, libraryId))
            .all(),
        db
            .select({
                id: insertables.id,
                buildIssues: insertables.buildIssues
            })
            .from(insertables)
            .where(visibleIn(libraryId))
            .all()
    ]);

    return summarizeHealth(allGroups, allInsertables);
}

/** Expects hidden insertables already filtered out. */
export function summarizeHealth(
    groups: { buildIssues: BuildIssue[] }[],
    insertables: { buildIssues: BuildIssue[] }[]
): LibraryHealthCounts {
    const counts: LibraryHealthCounts = {
        groupCount: groups.length,
        insertableCount: insertables.length,
        errorCount: 0,
        warningCount: 0,
        healthyItems: 0
    };

    const record = (issues: BuildIssue[]) => {
        if (getMaxSeverity(issues) === undefined) {
            counts.healthyItems++;
            return;
        }
        for (const issue of issues) {
            switch (getIssueSeverity(issue)) {
                case BuildIssueSeverity.ERROR:
                    counts.errorCount++;
                    break;
                case BuildIssueSeverity.WARNING:
                    counts.warningCount++;
                    break;
                // Counted by neither tile.
                case BuildIssueSeverity.INFO:
                    break;
            }
        }
    };

    for (const row of groups) record(row.buildIssues);
    for (const row of insertables) record(row.buildIssues);

    return counts;
}

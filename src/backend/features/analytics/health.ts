import { and, eq, type SQL } from "drizzle-orm";
import { type Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import { ElementType } from "../../lib/onshape/element-type";
import type { LibraryHealthCounts } from "./contract";
import {
    BuildIssueSeverity,
    getIssueSeverity,
    getMaxSeverity,
    type BuildIssue
} from "../build-checker/issues";

/** Hidden insertables skip the build checks, so they aren't counted at all. */
function visibleIn(libraryId: LibraryId | undefined): SQL | undefined {
    return and(
        libraryId ? eq(insertables.libraryId, libraryId) : undefined,
        eq(insertables.isVisible, true)
    );
}

/** One library's, or every library's together when `libraryId` is undefined. */
export async function getHealthCounts(
    db: Db,
    libraryId?: LibraryId
): Promise<LibraryHealthCounts> {
    const [allGroups, allInsertables] = await Promise.all([
        db
            .select({ buildIssues: groups.buildIssues })
            .from(groups)
            .where(libraryId ? eq(groups.libraryId, libraryId) : undefined)
            .all(),
        db
            .select({
                elementType: insertables.elementType,
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
    insertables: { elementType: ElementType; buildIssues: BuildIssue[] }[]
): LibraryHealthCounts {
    const counts: LibraryHealthCounts = {
        groupCount: groups.length,
        insertableCount: insertables.length,
        partStudioCount: 0,
        assemblyCount: 0,
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
    for (const row of insertables) {
        record(row.buildIssues);
        switch (row.elementType) {
            case ElementType.PART_STUDIO:
                counts.partStudioCount++;
                break;
            case ElementType.ASSEMBLY:
                counts.assemblyCount++;
                break;
        }
    }

    return counts;
}

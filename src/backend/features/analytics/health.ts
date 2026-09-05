/**
 * The library's build health, counted rather than listed: which items carry an
 * issue, and how severe the worst one is.
 */
import { and, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations, group, insertables } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import type { LibraryHealthCounts } from "./contract";
import {
    BuildIssueSeverity,
    getIssueSeverity,
    getMaxSeverity,
    type BuildIssue
} from "../build-checker/issues";

/**
 * Hidden insertables are exempt from the build checks, so the health report
 * leaves them out entirely rather than counting them as healthy.
 */
function visibleIn(libraryId: LibraryId) {
    return and(
        eq(insertables.libraryId, libraryId),
        eq(insertables.isVisible, true)
    );
}

/** Selects only what the counts need; names and paths are the item list's cost. */
export async function getHealthCounts(
    db: Db,
    libraryId: LibraryId
): Promise<LibraryHealthCounts> {
    const [groups, allInsertables] = await Promise.all([
        db
            .select({
                id: group.id,
                buildIssues: group.buildIssues,
                lastLoadedAt: group.lastLoadedAt
            })
            .from(group)
            .where(eq(group.libraryId, libraryId))
            .all(),
        db
            .select({
                id: insertables.id,
                groupId: insertables.groupId,
                buildIssues: insertables.buildIssues,
                lastLoadedAt: insertables.lastLoadedAt
            })
            .from(insertables)
            .where(visibleIn(libraryId))
            .all()
    ]);

    return summarizeHealth(
        groups,
        allInsertables,
        await getConfigurationIssues(db, libraryId)
    );
}

/**
 * An insertable's configuration issues, joined rather than fetched by id list
 * so the query stays one round trip regardless of library size. `parameters` is
 * deliberately not selected — it is large and unused here.
 */
async function getConfigurationIssues(
    db: Db,
    libraryId: LibraryId
): Promise<Map<string, BuildIssue[]>> {
    const rows = await db
        .select({
            id: configurations.id,
            buildIssues: configurations.buildIssues
        })
        .from(configurations)
        .innerJoin(insertables, eq(insertables.id, configurations.id))
        .where(visibleIn(libraryId))
        .all();
    return new Map(rows.map((row) => [row.id, row.buildIssues]));
}

/**
 * A group as the health summary needs it. `name`/paths are optional so the
 * overview can count without paying to fetch them.
 */
export interface HealthGroupRow {
    id: string;
    name?: string;
    documentId?: string;
    versionId?: string;
    buildIssues: BuildIssue[];
    lastLoadedAt: number | null;
}

export interface HealthInsertableRow {
    id: string;
    groupId: string;
    name?: string;
    elementId?: string;
    documentId?: string;
    versionId?: string;
    buildIssues: BuildIssue[];
    lastLoadedAt: number | null;
}

/**
 * Rolls groups and insertables up into the maintainer-facing health report.
 *
 * Every check is stored, so this only reads. The one inherited behaviour is
 * that an insertable's configuration issues count as its own, matching what
 * editors see in the panel. Hidden insertables are filtered out upstream —
 * they are exempt from the checks, so counting them would inflate "healthy".
 */
export function summarizeHealth(
    groups: HealthGroupRow[],
    insertables: HealthInsertableRow[],
    configurationIssues: Map<string, BuildIssue[]>
): LibraryHealthCounts {
    const counts: LibraryHealthCounts = {
        groupCount: groups.length,
        insertableCount: insertables.length,
        errorCount: 0,
        warningCount: 0,
        healthyItems: 0
    };

    const record = (issues: BuildIssue[]) => {
        if (getMaxSeverity(issues) === null) {
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
                // Info issues are counted by neither tile, so they only have
                // to leave the item healthy-or-not, which `record` already did.
                case BuildIssueSeverity.INFO:
                    break;
            }
        }
    };

    for (const row of groups) record(row.buildIssues);
    for (const row of insertables) {
        record([
            ...row.buildIssues,
            ...(configurationIssues.get(row.id) ?? [])
        ]);
    }

    return counts;
}

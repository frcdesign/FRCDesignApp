/**
 * Build checker: a small framework for flagging data-quality issues with groups
 * and insertables. Most checks run at build time (during the load-document
 * workflow) and are stored on the group/insertable; a few are computed live in
 * the frontend when they depend on per-user state (e.g. access level).
 */

export enum BuildIssueSeverity {
    /** A potential issue that is usually fine, e.g. no vendors parsed. */
    INFO = "info",
    /** A non-critical issue that should be fixed, e.g. no thumbnail tab set. */
    WARNING = "warning",
    /** A major issue, e.g. a thumbnail failing to generate. */
    ERROR = "error"
}

/** Discriminates the {@link BuildIssue} union. */
export enum BuildIssueType {
    THUMBNAIL_FAILED = "thumbnail-failed",
    NO_THUMBNAIL_TAB = "no-thumbnail-tab",
    NO_VENDORS = "no-vendors",
    NO_UNHIDDEN_INSERTABLES = "no-unhidden-insertables",
    TOO_MANY_CONFIGURATIONS = "too-many-configurations",
    PART_NUMBER_INDEX_INCOMPLETE = "part-number-index-incomplete"
}

/**
 * Base shape for a build issue, discriminated on type.
 */
interface BuildIssueOf<T extends BuildIssueType> {
    type: T;
}

export type BuildIssue =
    | BuildIssueOf<BuildIssueType.THUMBNAIL_FAILED>
    | BuildIssueOf<BuildIssueType.NO_THUMBNAIL_TAB>
    | BuildIssueOf<BuildIssueType.NO_VENDORS>
    | BuildIssueOf<BuildIssueType.NO_UNHIDDEN_INSERTABLES>
    | BuildIssueOf<BuildIssueType.TOO_MANY_CONFIGURATIONS>
    | BuildIssueOf<BuildIssueType.PART_NUMBER_INDEX_INCOMPLETE>;

/** The severity for a given issue, derived from its type. */
export function getIssueSeverity(issue: BuildIssue): BuildIssueSeverity {
    switch (issue.type) {
        case BuildIssueType.THUMBNAIL_FAILED:
        case BuildIssueType.NO_UNHIDDEN_INSERTABLES:
            return BuildIssueSeverity.ERROR;
        case BuildIssueType.NO_THUMBNAIL_TAB:
        case BuildIssueType.TOO_MANY_CONFIGURATIONS:
        case BuildIssueType.PART_NUMBER_INDEX_INCOMPLETE:
            return BuildIssueSeverity.WARNING;
        case BuildIssueType.NO_VENDORS:
            return BuildIssueSeverity.INFO;
    }
}

/**
 * Adds `issue` to `issues`, returning a new array.
 */
export function addBuildIssue(
    issues: BuildIssue[],
    issue: BuildIssue
): BuildIssue[] {
    if (issues.some((existing) => existing.type === issue.type)) {
        return issues;
    }
    return [...issues, issue];
}

/**
 * Removes any issue with the given `type`.
 */
export function clearBuildIssue(
    issues: BuildIssue[],
    type: BuildIssueType
): BuildIssue[] {
    return issues.filter((issue) => issue.type !== type);
}

/** Worst-to-best ordering. Higher index = more severe. */
const SEVERITY_ORDER: BuildIssueSeverity[] = [
    BuildIssueSeverity.INFO,
    BuildIssueSeverity.WARNING,
    BuildIssueSeverity.ERROR
];

/**
 * Returns the worst severity present in `issues`, or `null` when there are no issues.
 */
export function getMaxSeverity(
    issues: BuildIssue[]
): BuildIssueSeverity | null {
    let max: BuildIssueSeverity | null = null;
    for (const issue of issues) {
        const severity = getIssueSeverity(issue);
        if (
            max === null ||
            SEVERITY_ORDER.indexOf(severity) > SEVERITY_ORDER.indexOf(max)
        ) {
            max = severity;
        }
    }
    return max;
}

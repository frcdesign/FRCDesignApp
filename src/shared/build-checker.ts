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

/** Stable machine-readable identifier for each build check. */
export enum BuildIssueCode {
    ThumbnailFailed = "thumbnail-failed",
    NoThumbnailTab = "no-thumbnail-tab",
    NoVendors = "no-vendors",
    NoUnhiddenInsertables = "no-unhidden-insertables"
}

/**
 * Base shape for a build issue. Issues are a discriminated union keyed by
 * `code`, so individual variants can carry extra data alongside the code in the
 * future (e.g. `{ code: BuildIssueCode.X; count: number }`). Severity and the
 * human-readable message are derived from {@link BUILD_ISSUE_META} rather than
 * stored, so they stay consistent and can change without a data migration.
 */
interface BuildIssueBase<C extends BuildIssueCode> {
    code: C;
}

export type BuildIssue =
    | BuildIssueBase<BuildIssueCode.ThumbnailFailed>
    | BuildIssueBase<BuildIssueCode.NoThumbnailTab>
    | BuildIssueBase<BuildIssueCode.NoVendors>
    | BuildIssueBase<BuildIssueCode.NoUnhiddenInsertables>;

interface BuildIssueMeta {
    severity: BuildIssueSeverity;
    message: string;
}

/** Static severity + message for each issue code. */
export const BUILD_ISSUE_META: Record<BuildIssueCode, BuildIssueMeta> = {
    [BuildIssueCode.ThumbnailFailed]: {
        severity: BuildIssueSeverity.ERROR,
        message: "The thumbnail failed to generate."
    },
    [BuildIssueCode.NoThumbnailTab]: {
        severity: BuildIssueSeverity.WARNING,
        message:
            "No thumbnail tab is set, so the first tab is used as a fallback."
    },
    [BuildIssueCode.NoVendors]: {
        severity: BuildIssueSeverity.INFO,
        message: "No vendors were parsed for this element."
    },
    [BuildIssueCode.NoUnhiddenInsertables]: {
        severity: BuildIssueSeverity.ERROR,
        message: "This group has no unhidden insertables."
    }
};

export function getIssueSeverity(issue: BuildIssue): BuildIssueSeverity {
    return BUILD_ISSUE_META[issue.code].severity;
}

export function getIssueMessage(issue: BuildIssue): string {
    return BUILD_ISSUE_META[issue.code].message;
}

/**
 * Adds `issue` to `issues`, returning a new array. No-op (returns the original
 * array) if an issue with the same code is already present, so the same check
 * can be applied repeatedly without duplicating issues.
 */
export function addBuildIssue(
    issues: BuildIssue[],
    issue: BuildIssue
): BuildIssue[] {
    if (issues.some((existing) => existing.code === issue.code)) {
        return issues;
    }
    return [...issues, issue];
}

/**
 * Removes any issue with the given `code`, returning a new array. Used e.g. when
 * a thumbnail is successfully reloaded to clear a stale `thumbnail-failed`
 * issue.
 */
export function clearBuildIssue(
    issues: BuildIssue[],
    code: BuildIssueCode
): BuildIssue[] {
    return issues.filter((issue) => issue.code !== code);
}

/** Worst-to-best ordering. Higher index = more severe. */
const SEVERITY_ORDER: BuildIssueSeverity[] = [
    BuildIssueSeverity.INFO,
    BuildIssueSeverity.WARNING,
    BuildIssueSeverity.ERROR
];

/**
 * Returns the worst severity present in `issues`, or `null` when there are no
 * issues (i.e. all checks pass).
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

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

export interface BuildIssue {
    severity: BuildIssueSeverity;
    /** Stable machine-readable identifier for the check, e.g. "no-vendors". */
    code: string;
    /** Human-readable description shown in the build-status hover card. */
    message: string;
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
        if (
            max === null ||
            SEVERITY_ORDER.indexOf(issue.severity) > SEVERITY_ORDER.indexOf(max)
        ) {
            max = issue.severity;
        }
    }
    return max;
}

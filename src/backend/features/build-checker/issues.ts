/**
 * Data-quality issues for groups and insertables. Most are stored at load time;
 * a few are computed live where they depend on per-user state.
 */
import {
    AUTO_INDEX_THRESHOLD,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "../configurations/combinations";

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
    NO_PARTS = "no-parts",
    NO_UNHIDDEN_INSERTABLES = "no-unhidden-insertables",
    CONFIGURATION_LIMIT_EXCEEDED = "configuration-limit-exceeded",
    MANUAL_INDEXING_REQUIRED = "manual-indexing-required",
    MULTIPLE_PARTS = "multiple-parts",
    UNSTABLE_COMPOSITE = "unstable-composite",
    INSERTABLES_FAILED = "insertables-failed",
    LOAD_FAILED = "load-failed"
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
    | BuildIssueOf<BuildIssueType.NO_PARTS>
    | BuildIssueOf<BuildIssueType.NO_UNHIDDEN_INSERTABLES>
    | BuildIssueOf<BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED>
    | BuildIssueOf<BuildIssueType.MANUAL_INDEXING_REQUIRED>
    | BuildIssueOf<BuildIssueType.MULTIPLE_PARTS>
    | BuildIssueOf<BuildIssueType.UNSTABLE_COMPOSITE>
    | BuildIssueOf<BuildIssueType.INSERTABLES_FAILED>
    | BuildIssueOf<BuildIssueType.LOAD_FAILED>;

/** A human-readable description of a build issue, shown to editors. */
export function getIssueDescription(issue: BuildIssue): string {
    switch (issue.type) {
        case BuildIssueType.THUMBNAIL_FAILED:
            return "Thumbnail failed to generate";
        case BuildIssueType.NO_THUMBNAIL_TAB:
            return "No thumbnail tab set";
        case BuildIssueType.NO_VENDORS:
            return "No vendors could be parsed";
        case BuildIssueType.NO_PARTS:
            return "This part studio has no parts";
        case BuildIssueType.NO_UNHIDDEN_INSERTABLES:
            return "No unhidden insertables";
        case BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED:
            return `Over the ${MAX_PART_NUMBER_CONFIGURATIONS} configuration limit, so its configurations cannot be indexed`;
        case BuildIssueType.MANUAL_INDEXING_REQUIRED:
            return `Over ${AUTO_INDEX_THRESHOLD} configurations, so indexing must be enabled manually`;
        case BuildIssueType.MULTIPLE_PARTS:
            return "This part studio has more than one part";
        case BuildIssueType.UNSTABLE_COMPOSITE:
            return "The part studio does not use an open composite across all configurations";
        case BuildIssueType.INSERTABLES_FAILED:
            return "Some child insertables failed to load";
        case BuildIssueType.LOAD_FAILED:
            return "Failed to load from Onshape";
    }
}

/** The severity for a given issue, derived from its type. */
export function getIssueSeverity(issue: BuildIssue): BuildIssueSeverity {
    switch (issue.type) {
        case BuildIssueType.THUMBNAIL_FAILED:
        case BuildIssueType.NO_UNHIDDEN_INSERTABLES:
        case BuildIssueType.MULTIPLE_PARTS:
        case BuildIssueType.NO_PARTS:
        case BuildIssueType.UNSTABLE_COMPOSITE:
        case BuildIssueType.INSERTABLES_FAILED:
        case BuildIssueType.LOAD_FAILED:
            return BuildIssueSeverity.ERROR;
        case BuildIssueType.NO_THUMBNAIL_TAB:
        case BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED:
        case BuildIssueType.MANUAL_INDEXING_REQUIRED:
            return BuildIssueSeverity.WARNING;
        case BuildIssueType.NO_VENDORS:
            return BuildIssueSeverity.INFO;
    }
}

/**
 * Adds each of `newIssues` to `issues`, skipping any whose type is already
 * present, and returning a new array only when something was added.
 */
export function addBuildIssue(
    issues: BuildIssue[],
    ...newIssues: BuildIssue[]
): BuildIssue[] {
    const result = [...issues];
    for (const issue of newIssues) {
        if (!result.some((existing) => existing.type === issue.type)) {
            result.push(issue);
        }
    }
    return result;
}

/** Whether `issues` holds one of `types`. */
export function hasBuildIssue(
    issues: BuildIssue[],
    ...types: BuildIssueType[]
): boolean {
    return issues.some((issue) => types.includes(issue.type));
}

/**
 * Removes any issue whose type is one of `types`.
 */
export function clearBuildIssue(
    issues: BuildIssue[],
    ...types: BuildIssueType[]
): BuildIssue[] {
    return issues.filter((issue) => !types.includes(issue.type));
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

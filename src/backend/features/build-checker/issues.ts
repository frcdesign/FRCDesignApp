/** Mostly stored at load time; a few are computed live from per-user state. */
import {
    AUTO_INDEX_THRESHOLD,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "../configurations/combinations";
import type { PartialSelection } from "../configurations/contract";

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
    CONFIGURATION_MULTIPLE_PARTS = "configuration-multiple-parts",
    UNSTABLE_COMPOSITE = "unstable-composite",
    INSERTABLES_FAILED = "insertables-failed",
    LOAD_FAILED = "load-failed"
}

interface BuildIssueOf<T extends BuildIssueType> {
    type: T;
}

/** Raised by some configurations but not the defaults. */
interface ConfigurationBuildIssueOf<
    T extends ConfigurationIssueType
> extends BuildIssueOf<T> {
    /** The first offender's values, which the build card links out to. */
    values: PartialSelection;
    /** How many configurations raise it, that first one included. */
    configurationCount: number;
}

type ConfigurationIssueType =
    | BuildIssueType.CONFIGURATION_MULTIPLE_PARTS
    | BuildIssueType.UNSTABLE_COMPOSITE;

export type BuildIssue =
    | BuildIssueOf<BuildIssueType.THUMBNAIL_FAILED>
    | BuildIssueOf<BuildIssueType.NO_THUMBNAIL_TAB>
    | BuildIssueOf<BuildIssueType.NO_VENDORS>
    | BuildIssueOf<BuildIssueType.NO_PARTS>
    | BuildIssueOf<BuildIssueType.NO_UNHIDDEN_INSERTABLES>
    | BuildIssueOf<BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED>
    | BuildIssueOf<BuildIssueType.MANUAL_INDEXING_REQUIRED>
    | BuildIssueOf<BuildIssueType.MULTIPLE_PARTS>
    | ConfigurationBuildIssueOf<BuildIssueType.CONFIGURATION_MULTIPLE_PARTS>
    | ConfigurationBuildIssueOf<BuildIssueType.UNSTABLE_COMPOSITE>
    | BuildIssueOf<BuildIssueType.INSERTABLES_FAILED>
    | BuildIssueOf<BuildIssueType.LOAD_FAILED>;

/** The card links to the first; the rest are counted. */
export function toConfigurationIssue(
    type: ConfigurationIssueType,
    offenders: { values: PartialSelection }[]
): BuildIssue {
    return {
        type,
        values: offenders[0].values,
        configurationCount: offenders.length
    };
}

/** Undefined when the element itself is at fault. */
export function getIssueConfiguration(
    issue: BuildIssue
): PartialSelection | undefined {
    return "values" in issue ? issue.values : undefined;
}

const BUILD_ISSUE_TYPES = new Set<string>(Object.values(BuildIssueType));

/** Drops types a later deploy removed. */
export function knownBuildIssues(issues: BuildIssue[]): BuildIssue[] {
    return issues.filter((issue) => BUILD_ISSUE_TYPES.has(issue.type));
}

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
        case BuildIssueType.CONFIGURATION_MULTIPLE_PARTS:
            return issue.configurationCount === 1
                ? "A configuration resolves to more than one part"
                : `${issue.configurationCount} configurations resolve to more than one part`;
        case BuildIssueType.UNSTABLE_COMPOSITE:
            return issue.configurationCount === 1
                ? "A configuration does not use the part studio's open composite"
                : `${issue.configurationCount} configurations do not use the part studio's open composite`;
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
        case BuildIssueType.CONFIGURATION_MULTIPLE_PARTS:
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

/** Skips types already present; returns the same array if nothing was added. */
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

export function getMaxSeverity(
    issues: BuildIssue[]
): BuildIssueSeverity | undefined {
    let max: BuildIssueSeverity | undefined;
    for (const issue of issues) {
        const severity = getIssueSeverity(issue);
        if (
            max === undefined ||
            SEVERITY_ORDER.indexOf(severity) > SEVERITY_ORDER.indexOf(max)
        ) {
            max = severity;
        }
    }
    return max;
}

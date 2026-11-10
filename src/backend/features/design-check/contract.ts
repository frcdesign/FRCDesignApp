/** What a design check answers. A leaf, so the frontend imports it whole. */
import { BuildIssueSeverity } from "../build-checker/issues";
import { type ElementType } from "../../lib/onshape/element-type";

export enum DesignIssueType {
    SKETCH_UNDERDEFINED = "sketch-underdefined",
    SKETCH_OVERDEFINED = "sketch-overdefined",
    ORIGIN_CUBE_MISSING = "origin-cube-missing",
    ORIGIN_CUBE_NOT_FIRST = "origin-cube-not-first",
    ORIGIN_CUBE_SUPPRESSED = "origin-cube-suppressed",
    /** A red feature or mate. */
    FEATURE_ERROR = "feature-error",
    /** A yellow feature or mate. */
    FEATURE_WARNING = "feature-warning",
    FEATURE_SUPPRESSED = "feature-suppressed",
    ROLLBACK_NOT_AT_END = "rollback-not-at-end",
    PART_NO_MATERIAL = "part-no-material",
    PART_NO_PART_NUMBER = "part-no-part-number",
    PART_NO_DESCRIPTION = "part-no-description",
    INSTANCE_FIXED = "instance-fixed",
    /** Not mated, grouped, fixed or patterned. */
    INSTANCE_FLOATING = "instance-floating",
    INSTANCE_BROKEN = "instance-broken"
}

export interface DesignIssue {
    type: DesignIssueType;
    /** The feature, part or instance's name in Onshape; absent for one about the whole tab. */
    subject?: string;
    /** Set for a feature or mate, which the page opens in Onshape where Onshape will. */
    featureId?: string;
    /** A part's, or the part a part instance shows; the page selects it in Onshape. */
    partId?: string;
    instanceId?: string;
    /** The Origin Cube's place in the list, or how many features the rollback bar hides. */
    count?: number;
}

export interface DesignCheckOut {
    elementType: ElementType;
    /** Errors first, then warnings, then info. */
    issues: DesignIssue[];
    /** Onshape reported no sketch's definition, so under-defined sketches went unchecked. */
    sketchStatusUnknown: boolean;
    /** Epoch ms. */
    checkedAt: number;
}

/** FRCDesign's severity for a type, which a person's levels may change. */
export function getDesignIssueSeverity(
    type: DesignIssueType
): BuildIssueSeverity {
    switch (type) {
        case DesignIssueType.SKETCH_OVERDEFINED:
        case DesignIssueType.ORIGIN_CUBE_SUPPRESSED:
        case DesignIssueType.FEATURE_ERROR:
        case DesignIssueType.INSTANCE_BROKEN:
            return BuildIssueSeverity.ERROR;
        case DesignIssueType.SKETCH_UNDERDEFINED:
        case DesignIssueType.ORIGIN_CUBE_MISSING:
        case DesignIssueType.ORIGIN_CUBE_NOT_FIRST:
        case DesignIssueType.FEATURE_WARNING:
        case DesignIssueType.ROLLBACK_NOT_AT_END:
        case DesignIssueType.PART_NO_MATERIAL:
        case DesignIssueType.INSTANCE_FIXED:
        case DesignIssueType.INSTANCE_FLOATING:
            return BuildIssueSeverity.WARNING;
        case DesignIssueType.FEATURE_SUPPRESSED:
        case DesignIssueType.PART_NO_PART_NUMBER:
        case DesignIssueType.PART_NO_DESCRIPTION:
            return BuildIssueSeverity.INFO;
    }
}

const SEVERITY_RANK: Record<BuildIssueSeverity, number> = {
    [BuildIssueSeverity.ERROR]: 0,
    [BuildIssueSeverity.WARNING]: 1,
    [BuildIssueSeverity.INFO]: 2
};

/** Worst first. */
export function compareSeverity(
    a: BuildIssueSeverity,
    b: BuildIssueSeverity
): number {
    return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

/** How a person wants a type shown: at a severity, or not at all. */
export const DESIGN_ISSUE_LEVELS = [
    BuildIssueSeverity.ERROR,
    BuildIssueSeverity.WARNING,
    BuildIssueSeverity.INFO,
    "off"
] as const;

export type DesignIssueLevel = (typeof DESIGN_ISSUE_LEVELS)[number];

/** One person's choices; a type left out shows at FRCDesign's severity. */
export type DesignIssueLevels = Partial<
    Record<DesignIssueType, DesignIssueLevel>
>;

/** GET and POST /api/design-check/levels */
export interface DesignCheckLevelsOut {
    levels: DesignIssueLevels;
}

export function getDesignIssueLevel(
    type: DesignIssueType,
    levels: DesignIssueLevels
): DesignIssueLevel {
    return levels[type] ?? getDesignIssueSeverity(type);
}

/** The severity a type shows at, or undefined once it is turned off. */
export function getShownSeverity(
    type: DesignIssueType,
    levels: DesignIssueLevels
): BuildIssueSeverity | undefined {
    const level = getDesignIssueLevel(type, levels);
    return level === "off" ? undefined : level;
}

/** How many of each type one check found, which analytics records. */
export type DesignIssueCounts = Partial<Record<DesignIssueType, number>>;

export function countDesignIssues(issues: DesignIssue[]): DesignIssueCounts {
    const counts: DesignIssueCounts = {};
    for (const issue of issues) {
        counts[issue.type] = (counts[issue.type] ?? 0) + 1;
    }
    return counts;
}

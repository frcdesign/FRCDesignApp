import { ThumbnailUrls } from "../thumbnails/contract";
import { getVendorName, Vendor } from "../library/vendors";
import { readVendorOption, VendorOptionMatch } from "../library/vendor-options";
import {
    type ConfigurationParameter,
    ParameterRole,
    ParameterType
} from "../configurations/contract";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueType,
    clearBuildIssue,
    type VendorOptionProblem
} from "./issues";

interface GroupCheckInput {
    /** Whether the Onshape document has a designated thumbnail tab/element. */
    hasThumbnailTab: boolean;
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
    /** Whether any of the group's insertables failed to load. */
    hasFailedInsertables: boolean;
    hasVisibleInsertable: boolean;
    /** Onshape's `public`: every Onshape user can view and copy it. */
    isPublic: boolean;
}

/** Pure: the load resolves the signals. */
export function checkGroup(input: GroupCheckInput): BuildIssue[] {
    let issues: BuildIssue[] = [];

    if (input.thumbnailUrls === null) {
        issues = addBuildIssue(issues, {
            type: BuildIssueType.THUMBNAIL_FAILED
        });
    } else if (!input.hasThumbnailTab) {
        issues = addBuildIssue(issues, {
            type: BuildIssueType.NO_THUMBNAIL_TAB
        });
    }

    if (input.hasFailedInsertables) {
        issues = addBuildIssue(issues, {
            type: BuildIssueType.INSERTABLES_FAILED
        });
    }

    if (!input.isPublic) {
        issues = addBuildIssue(issues, { type: BuildIssueType.NOT_PUBLIC });
    }

    return checkVisibility(issues, input.hasVisibleInsertable);
}

/** Re-runs the one group check that showing or hiding an insertable changes. */
export function checkVisibility(
    issues: BuildIssue[],
    hasVisibleInsertable: boolean
): BuildIssue[] {
    return hasVisibleInsertable
        ? clearBuildIssue(issues, BuildIssueType.NO_UNHIDDEN_INSERTABLES)
        : addBuildIssue(issues, {
              type: BuildIssueType.NO_UNHIDDEN_INSERTABLES
          });
}

interface InsertableCheckInput {
    vendors: Vendor[];
    /** Its Vendor parameters' options are checked against the library's vendors. */
    parameters: ConfigurationParameter[];
    /** The stored thumbnail URLs, or `null` when the render has not landed. */
    thumbnailUrls: ThumbnailUrls | null;
}

/** Pure: the load resolves the signals. */
export function checkInsertable(input: InsertableCheckInput): BuildIssue[] {
    let issues: BuildIssue[] = [];

    if (input.thumbnailUrls === null) {
        issues = addBuildIssue(issues, {
            type: BuildIssueType.THUMBNAIL_FAILED
        });
    }

    if (input.vendors.length === 0) {
        issues = addBuildIssue(issues, { type: BuildIssueType.NO_VENDORS });
    }

    const problems = vendorOptionProblems(input.parameters);
    if (problems.length > 0) {
        issues = addBuildIssue(issues, {
            type: BuildIssueType.VENDOR_OPTIONS,
            problems
        });
    }

    return issues;
}

/** Every option of a Vendor parameter that isn't Generic or a vendor's exact name. */
export function vendorOptionProblems(
    parameters: ConfigurationParameter[]
): VendorOptionProblem[] {
    const options = parameters.flatMap((parameter) =>
        parameter.role === ParameterRole.VENDOR &&
        parameter.type === ParameterType.ENUM
            ? parameter.options.map((option) => option.name)
            : []
    );
    return [...new Set(options)].flatMap((option): VendorOptionProblem[] => {
        const read = readVendorOption(option);
        switch (read.match) {
            case VendorOptionMatch.EXACT:
            case VendorOptionMatch.GENERIC:
                return [];
            case VendorOptionMatch.ABBREVIATION:
            case VendorOptionMatch.MISSPELLED:
                return [{ option, expected: getVendorName(read.vendor) }];
            case VendorOptionMatch.UNKNOWN:
                return [{ option }];
        }
    });
}

import { ThumbnailUrls, Vendor } from "../../shared/types";
import { BuildIssue, BuildIssueSeverity } from "../../shared/build-checker";

interface GroupCheckInput {
    /** Whether the Onshape document has a designated thumbnail tab/element. */
    hasThumbnailTab: boolean;
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
}

/**
 * Computes build-time issues for a group. Pure: takes already-resolved signals
 * from the load-document workflow rather than fetching anything itself.
 */
export function checkGroup(input: GroupCheckInput): BuildIssue[] {
    const issues: BuildIssue[] = [];

    if (input.thumbnailUrls === null) {
        issues.push({
            severity: BuildIssueSeverity.ERROR,
            code: "thumbnail-failed",
            message: "The group thumbnail failed to generate."
        });
    } else if (!input.hasThumbnailTab) {
        issues.push({
            severity: BuildIssueSeverity.WARNING,
            code: "no-thumbnail-tab",
            message:
                "No thumbnail tab is set, so the first tab is used as a fallback."
        });
    }

    return issues;
}

interface InsertableCheckInput {
    vendors: Vendor[];
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
}

/**
 * Computes build-time issues for an insertable. Pure: takes already-resolved
 * signals from the load-document workflow rather than fetching anything itself.
 */
export function checkInsertable(input: InsertableCheckInput): BuildIssue[] {
    const issues: BuildIssue[] = [];

    if (input.thumbnailUrls === null) {
        issues.push({
            severity: BuildIssueSeverity.ERROR,
            code: "thumbnail-failed",
            message: "The thumbnail failed to generate."
        });
    }

    if (input.vendors.length === 0) {
        issues.push({
            severity: BuildIssueSeverity.INFO,
            code: "no-vendors",
            message: "No vendors were parsed for this element."
        });
    }

    return issues;
}

import { ThumbnailUrls } from "../thumbnails/types";
import { Vendor, isCustomPart } from "../library/vendors";
import { addBuildIssue, BuildIssue, BuildIssueType } from "./issues";
import type { PartData } from "../configurations/models";

interface GroupCheckInput {
    /** Whether the Onshape document has a designated thumbnail tab/element. */
    hasThumbnailTab: boolean;
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
    /** Whether any of the group's insertables failed to load. */
    hasFailedInsertables: boolean;
}

/**
 * Computes build-time issues for a group. Pure: takes already-resolved signals
 * from the load-document workflow rather than fetching anything itself.
 */
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

    return issues;
}

interface InsertableCheckInput {
    vendors: Vendor[];
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
    /** The element's own part data, plus one per indexed configuration. */
    probed: (PartData | null)[];
}

/**
 * Computes build-time issues for an insertable. Pure: takes already-resolved
 * signals from the load-document workflow rather than fetching anything itself.
 */
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

    issues = addBuildIssue(
        issues,
        ...checkIndexedPartNumber(input.vendors, input.probed)
    );

    return issues;
}

/**
 * A custom part is expected to have no part number; anything a vendor sells
 * should have one in at least one configuration.
 */
/** `probed` is the element's own part data plus any indexed configuration's. */
export function checkIndexedPartNumber(
    vendors: Vendor[],
    probed: (PartData | null)[]
): BuildIssue[] {
    const found = probed.filter((data) => data !== null);
    if (isCustomPart(vendors) || found.length === 0) {
        return [];
    }
    return found.some((data) => data.partNumber)
        ? []
        : [{ type: BuildIssueType.NO_PART_NUMBER }];
}

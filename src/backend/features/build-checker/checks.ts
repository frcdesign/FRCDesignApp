import { ThumbnailUrls } from "../thumbnails/types";
import { Vendor, isCustomPart } from "../library/vendors";
import { addBuildIssue, BuildIssue, BuildIssueType } from "./issues";
import type { PartMetadata } from "../configurations/models";

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
    /** Every probe of the element: its own, plus one per indexed configuration. */
    probes: (PartMetadata | null)[];
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
        ...checkIndexedPartNumber(input.vendors, input.probes)
    );

    return issues;
}

/**
 * A custom part is expected to have no part number; anything a vendor sells
 * should have one in at least one configuration.
 */
/** Every probe of an element: its own, plus one per indexed configuration. */
export function checkIndexedPartNumber(
    vendors: Vendor[],
    probes: (PartMetadata | null)[]
): BuildIssue[] {
    const read = probes.filter((probe) => probe !== null);
    if (isCustomPart(vendors) || read.length === 0) {
        return [];
    }
    return read.some((probe) => probe.partNumber)
        ? []
        : [{ type: BuildIssueType.NO_PART_NUMBER }];
}

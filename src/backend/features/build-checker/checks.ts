import { ThumbnailUrls } from "../thumbnails/contract";
import { Vendor } from "../library/vendors";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueType,
    clearBuildIssue
} from "./issues";

interface GroupCheckInput {
    /** Whether the Onshape document has a designated thumbnail tab/element. */
    hasThumbnailTab: boolean;
    /** The uploaded thumbnail URLs, or `null` when generation failed. */
    thumbnailUrls: ThumbnailUrls | null;
    /** Whether any of the group's insertables failed to load. */
    hasFailedInsertables: boolean;
    hasVisibleInsertable: boolean;
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

    return issues;
}

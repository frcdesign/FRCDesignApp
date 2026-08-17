import { describe, expect, it } from "vitest";
import { ThumbnailSize, ThumbnailUrls, Vendor } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-issues";
import { DEFAULT_CANONICAL_CONFIGURATION } from "../../shared/canonical-configuration";
import { thumbnailUrl } from "../../shared/thumbnails";
import { checkGroup, checkInsertable } from "./build-checks";

/** What uploadThumbnails returns: the element's default configuration. */
const THUMBNAILS: ThumbnailUrls = {
    small: defaultThumbnailUrl(ThumbnailSize.SMALL),
    large: defaultThumbnailUrl(ThumbnailSize.LARGE)
};

function defaultThumbnailUrl(size: ThumbnailSize): string {
    return thumbnailUrl({
        elementId: "element",
        microversionId: "microversion",
        size,
        canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
    });
}

/** A group with nothing wrong; each test spreads in the one fault it checks. */
const HEALTHY_GROUP = {
    hasThumbnailTab: true,
    thumbnailUrls: THUMBNAILS,
    hasFailedInsertables: false
};

describe("checkGroup", () => {
    it("returns no issues for a healthy group", () => {
        expect(checkGroup(HEALTHY_GROUP)).toEqual([]);
    });

    it("warns when no thumbnail tab is set", () => {
        const issues = checkGroup({
            ...HEALTHY_GROUP,
            hasThumbnailTab: false
        });
        expect(issues).toEqual([{ type: BuildIssueType.NO_THUMBNAIL_TAB }]);
    });

    it("errors when the thumbnail failed to generate", () => {
        const issues = checkGroup({ ...HEALTHY_GROUP, thumbnailUrls: null });
        expect(issues).toEqual([{ type: BuildIssueType.THUMBNAIL_FAILED }]);
    });

    it("errors when an insertable failed to load", () => {
        const issues = checkGroup({
            ...HEALTHY_GROUP,
            hasFailedInsertables: true
        });
        expect(issues).toEqual([{ type: BuildIssueType.INSERTABLES_FAILED }]);
    });
});

describe("checkInsertable", () => {
    it("returns no issues when vendors are parsed and thumbnails generated", () => {
        expect(
            checkInsertable({
                vendors: [Vendor.REV],
                thumbnailUrls: THUMBNAILS
            })
        ).toEqual([]);
    });

    it("infos when no vendors are parsed", () => {
        const issues = checkInsertable({
            vendors: [],
            thumbnailUrls: THUMBNAILS
        });
        expect(issues).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });

    it("errors when the thumbnail failed to generate", () => {
        const issues = checkInsertable({
            vendors: [Vendor.REV],
            thumbnailUrls: null
        });
        expect(issues).toEqual([{ type: BuildIssueType.THUMBNAIL_FAILED }]);
    });
});

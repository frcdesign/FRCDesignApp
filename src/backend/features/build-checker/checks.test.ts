import { describe, expect, it } from "vitest";
import { ThumbnailSize, ThumbnailUrls } from "../thumbnails/types";
import { Vendor } from "../library/vendors";
import { BuildIssueType } from "./issues";
import { ELEMENT_DEFAULT_KEY } from "../configurations/selection";
import { thumbnailUrl } from "../thumbnails/keys";
import { checkGroup, checkInsertable } from "./checks";

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
        configurationKey: ELEMENT_DEFAULT_KEY
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
    const HEALTHY_INSERTABLE = {
        vendors: [Vendor.REV],
        thumbnailUrls: THUMBNAILS
    };

    it("returns no issues when vendors are parsed and thumbnails generated", () => {
        expect(checkInsertable(HEALTHY_INSERTABLE)).toEqual([]);
    });

    it("infos when no vendors are parsed", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            vendors: []
        });
        expect(issues).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });

    it("errors when the thumbnail failed to generate", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            thumbnailUrls: null
        });
        expect(issues).toEqual([{ type: BuildIssueType.THUMBNAIL_FAILED }]);
    });
});

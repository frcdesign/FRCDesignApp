import { describe, expect, it } from "vitest";
import { ThumbnailSize, ThumbnailUrls, Vendor } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-checker";
import { checkGroup, checkInsertable } from "./build-checks";

const THUMBNAILS: ThumbnailUrls = {
    [ThumbnailSize.TINY]: "/api/thumbnail/tiny/x",
    [ThumbnailSize.STANDARD]: "/api/thumbnail/standard/x"
};

describe("checkGroup", () => {
    it("warns when no thumbnail tab is set", () => {
        const issues = checkGroup({
            hasThumbnailTab: false,
            thumbnailUrls: THUMBNAILS
        });
        expect(issues).toEqual([{ type: BuildIssueType.NO_THUMBNAIL_TAB }]);
    });

    it("errors when the thumbnail failed to generate", () => {
        const issues = checkGroup({
            hasThumbnailTab: true,
            thumbnailUrls: null
        });
        expect(issues).toEqual([{ type: BuildIssueType.THUMBNAIL_FAILED }]);
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

import { describe, expect, it } from "vitest";
import { ThumbnailSize, ThumbnailUrls, Vendor } from "../../shared/types";
import {
    BuildIssueSeverity,
    BuildIssueType,
    getIssueSeverity
} from "../../shared/build-checker";
import { checkGroup, checkInsertable } from "./build-checks";

const THUMBNAILS: ThumbnailUrls = {
    [ThumbnailSize.TINY]: "/api/thumbnail/tiny/x",
    [ThumbnailSize.STANDARD]: "/api/thumbnail/standard/x"
};

describe("checkGroup", () => {
    it("returns no issues when a thumbnail tab is set and thumbnails generated", () => {
        expect(
            checkGroup({ hasThumbnailTab: true, thumbnailUrls: THUMBNAILS })
        ).toEqual([]);
    });

    it("warns when no thumbnail tab is set", () => {
        const issues = checkGroup({
            hasThumbnailTab: false,
            thumbnailUrls: THUMBNAILS
        });
        expect(issues).toHaveLength(1);
        expect(getIssueSeverity(issues[0])).toBe(BuildIssueSeverity.WARNING);
        expect(issues[0].type).toBe(BuildIssueType.NO_THUMBNAIL_TAB);
    });

    it("errors when the thumbnail failed to generate", () => {
        const issues = checkGroup({
            hasThumbnailTab: true,
            thumbnailUrls: null
        });
        expect(issues).toHaveLength(1);
        expect(getIssueSeverity(issues[0])).toBe(BuildIssueSeverity.ERROR);
        expect(issues[0].type).toBe(BuildIssueType.THUMBNAIL_FAILED);
    });

    it("prefers the thumbnail error over the missing-tab warning", () => {
        const issues = checkGroup({
            hasThumbnailTab: false,
            thumbnailUrls: null
        });
        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe(BuildIssueType.THUMBNAIL_FAILED);
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
        expect(issues).toHaveLength(1);
        expect(getIssueSeverity(issues[0])).toBe(BuildIssueSeverity.INFO);
        expect(issues[0].type).toBe(BuildIssueType.NO_VENDORS);
    });

    it("errors when the thumbnail failed to generate", () => {
        const issues = checkInsertable({
            vendors: [Vendor.REV],
            thumbnailUrls: null
        });
        expect(issues).toHaveLength(1);
        expect(getIssueSeverity(issues[0])).toBe(BuildIssueSeverity.ERROR);
        expect(issues[0].type).toBe(BuildIssueType.THUMBNAIL_FAILED);
    });

    it("reports both the thumbnail error and the no-vendors info", () => {
        const issues = checkInsertable({ vendors: [], thumbnailUrls: null });
        expect(issues.map((i) => i.type)).toEqual([
            BuildIssueType.THUMBNAIL_FAILED,
            BuildIssueType.NO_VENDORS
        ]);
    });
});

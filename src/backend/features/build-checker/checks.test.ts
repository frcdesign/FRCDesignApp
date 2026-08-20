import { describe, expect, it } from "vitest";
import { ThumbnailSize, ThumbnailUrls } from "../thumbnails/types";
import { Vendor } from "../library/vendors";
import { BuildIssueType } from "./issues";
import { DEFAULT_CANONICAL_CONFIGURATION } from "../configurations/canonical";
import { thumbnailUrl } from "../thumbnails/keys";
import { checkGroup, checkInsertable } from "./checks";
import type { ConfigurationRecord } from "../configurations/models";

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

/** An indexed record; only its part number matters to these checks. */
function record(partNumber: string | null): ConfigurationRecord {
    return {
        configuration: {},
        partNumber,
        name: null,
        description: null,
        material: null,
        vendor: null,
        hasMultipleParts: false,
        isUnstableComposite: false
    };
}

describe("checkInsertable", () => {
    const HEALTHY_INSERTABLE = {
        vendors: [Vendor.REV],
        thumbnailUrls: THUMBNAILS,
        probed: [record("217-2600")]
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

    it("warns when a vendor part indexed without a part number", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            probed: [record(null), record(null)]
        });
        expect(issues).toEqual([{ type: BuildIssueType.NO_PART_NUMBER }]);
    });

    it("does not warn when only some configurations lack one", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            probed: [record(null), record("217-2600")]
        });
        expect(issues).toEqual([]);
    });

    // Nobody sells it, so having no part number is the expected state.
    it("does not warn about a custom part", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            vendors: [Vendor.CUSTOM],
            probed: [record(null)]
        });
        expect(issues).toEqual([]);
    });

    // Nothing was probed, so there is nothing to conclude.
    it("does not warn when the insertable is not indexed", () => {
        const issues = checkInsertable({ ...HEALTHY_INSERTABLE, probed: [] });
        expect(issues).toEqual([]);
    });
});

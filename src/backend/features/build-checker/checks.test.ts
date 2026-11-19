import { describe, expect, it } from "vitest";
import { ThumbnailSize, ThumbnailUrls } from "../thumbnails/contract";
import { Vendor } from "../library/vendors";
import { type BuildIssue, BuildIssueType } from "./issues";
import {
    type ConfigurationParameter,
    DEFAULT_CONFIGURATION_KEY,
    ParameterRole
} from "../configurations/contract";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";
import { thumbnailUrl } from "../thumbnails/keys";
import { checkGroup, checkInsertable, checkVisibility } from "./checks";

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
        configurationKey: DEFAULT_CONFIGURATION_KEY
    });
}

/** A group with nothing wrong; each test spreads in the one fault it checks. */
const HEALTHY_GROUP = {
    hasThumbnailTab: true,
    thumbnailUrls: THUMBNAILS,
    hasFailedInsertables: false,
    hasVisibleInsertable: true,
    isPublic: true
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

    it("errors when the document isn't public", () => {
        const issues = checkGroup({ ...HEALTHY_GROUP, isPublic: false });
        expect(issues).toEqual([{ type: BuildIssueType.NOT_PUBLIC }]);
    });

    it("errors when every insertable is hidden", () => {
        const issues = checkGroup({
            ...HEALTHY_GROUP,
            hasVisibleInsertable: false
        });
        expect(issues).toEqual([
            { type: BuildIssueType.NO_UNHIDDEN_INSERTABLES }
        ]);
    });
});

describe("checkVisibility", () => {
    const OTHER_ISSUE: BuildIssue = { type: BuildIssueType.NO_THUMBNAIL_TAB };
    const HIDDEN_ISSUE: BuildIssue = {
        type: BuildIssueType.NO_UNHIDDEN_INSERTABLES
    };

    it("flags a group with nothing visible, keeping its other issues", () => {
        expect(checkVisibility([OTHER_ISSUE], false)).toEqual([
            OTHER_ISSUE,
            HIDDEN_ISSUE
        ]);
    });

    it("clears the flag once an insertable is shown", () => {
        expect(checkVisibility([OTHER_ISSUE, HIDDEN_ISSUE], true)).toEqual([
            OTHER_ISSUE
        ]);
    });
});

describe("checkInsertable", () => {
    const HEALTHY_INSERTABLE = {
        vendors: [Vendor.REV],
        parameters: [],
        thumbnailUrls: THUMBNAILS
    };

    function vendorParameter(...options: string[]): ConfigurationParameter {
        return {
            ...enumParam(
                "vendor",
                options.map((_, index) => `option-${index}`)
            ),
            name: "Vendor",
            options: options.map((name, index) => ({
                id: `option-${index}`,
                name
            })),
            role: ParameterRole.VENDOR
        };
    }

    it("passes a Vendor parameter naming vendors exactly, and Generic", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            parameters: [
                vendorParameter(
                    "Generic",
                    "West Coast Products",
                    "McMaster-Carr"
                )
            ]
        });
        expect(issues).toEqual([]);
    });

    it("warns of a Vendor parameter's abbreviated, misspelled and unknown options", () => {
        const issues = checkInsertable({
            ...HEALTHY_INSERTABLE,
            parameters: [
                vendorParameter(
                    "WCP",
                    "mcmaster carr",
                    "Thrifty Bot",
                    "Swerve Drive Specialities",
                    "Acme Hardware"
                )
            ]
        });
        expect(issues).toEqual([
            {
                type: BuildIssueType.VENDOR_OPTIONS,
                problems: [
                    { option: "WCP", expected: "West Coast Products" },
                    { option: "mcmaster carr", expected: "McMaster-Carr" },
                    { option: "Thrifty Bot", expected: "The Thrifty Bot" },
                    {
                        option: "Swerve Drive Specialities",
                        expected: "Swerve Drive Specialties"
                    },
                    { option: "Acme Hardware" }
                ]
            }
        ]);
    });

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

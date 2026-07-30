import { describe, expect, it } from "vitest";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    clearBuildIssue,
    getIssueSeverity,
    getMaxSeverity
} from "./build-checker";

/** A representative issue type for each severity. */
const TYPE_BY_SEVERITY: Record<BuildIssueSeverity, BuildIssueType> = {
    [BuildIssueSeverity.INFO]: BuildIssueType.NO_VENDORS,
    [BuildIssueSeverity.WARNING]: BuildIssueType.NO_THUMBNAIL_TAB,
    [BuildIssueSeverity.ERROR]: BuildIssueType.THUMBNAIL_FAILED
};

const issue = (severity: BuildIssueSeverity): BuildIssue => ({
    type: TYPE_BY_SEVERITY[severity]
});

describe("getIssueSeverity", () => {
    // A part number picked arbitrarily from several parts is wrong data, not a
    // hint, so these are errors rather than warnings.
    it.each([
        BuildIssueType.MULTIPLE_PARTS,
        BuildIssueType.INSERTABLES_FAILED,
        BuildIssueType.LOAD_FAILED
    ])("rates %s as an error", (type) => {
        expect(getIssueSeverity({ type })).toBe(BuildIssueSeverity.ERROR);
    });
});

describe("getMaxSeverity", () => {
    it("returns null when there are no issues", () => {
        expect(getMaxSeverity([])).toBeNull();
    });

    it("returns the only severity present", () => {
        expect(getMaxSeverity([issue(BuildIssueSeverity.INFO)])).toBe(
            BuildIssueSeverity.INFO
        );
    });

    it("returns the worst severity for a mix", () => {
        expect(
            getMaxSeverity([
                issue(BuildIssueSeverity.INFO),
                issue(BuildIssueSeverity.ERROR),
                issue(BuildIssueSeverity.WARNING)
            ])
        ).toBe(BuildIssueSeverity.ERROR);
    });

    it("ranks warning above info", () => {
        expect(
            getMaxSeverity([
                issue(BuildIssueSeverity.INFO),
                issue(BuildIssueSeverity.WARNING)
            ])
        ).toBe(BuildIssueSeverity.WARNING);
    });
});

describe("addBuildIssue", () => {
    it("appends a new issue", () => {
        const result = addBuildIssue([], {
            type: BuildIssueType.NO_VENDORS
        });
        expect(result).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });

    it("does not duplicate an issue with the same type", () => {
        const existing: BuildIssue[] = [{ type: BuildIssueType.NO_VENDORS }];
        const result = addBuildIssue(existing, {
            type: BuildIssueType.NO_VENDORS
        });
        expect(result).toBe(existing);
    });
});

describe("clearBuildIssue", () => {
    it("removes issues with the given type", () => {
        const result = clearBuildIssue(
            [
                { type: BuildIssueType.THUMBNAIL_FAILED },
                { type: BuildIssueType.NO_VENDORS }
            ],
            BuildIssueType.THUMBNAIL_FAILED
        );
        expect(result).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });

    it("returns an equivalent array when the type is absent", () => {
        const result = clearBuildIssue(
            [{ type: BuildIssueType.NO_VENDORS }],
            BuildIssueType.THUMBNAIL_FAILED
        );
        expect(result).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });
});

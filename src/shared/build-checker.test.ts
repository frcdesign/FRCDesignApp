import { describe, expect, it } from "vitest";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    clearBuildIssue,
    getMaxSeverity
} from "./build-checker";

/** A representative issue type for each severity. */
const TYPE_BY_SEVERITY: Record<BuildIssueSeverity, BuildIssueType> = {
    [BuildIssueSeverity.INFO]: BuildIssueType.NoVendors,
    [BuildIssueSeverity.WARNING]: BuildIssueType.NoThumbnailTab,
    [BuildIssueSeverity.ERROR]: BuildIssueType.ThumbnailFailed
};

const issue = (severity: BuildIssueSeverity): BuildIssue => ({
    type: TYPE_BY_SEVERITY[severity]
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
            type: BuildIssueType.NoVendors
        });
        expect(result).toEqual([{ type: BuildIssueType.NoVendors }]);
    });

    it("does not duplicate an issue with the same type", () => {
        const existing: BuildIssue[] = [{ type: BuildIssueType.NoVendors }];
        const result = addBuildIssue(existing, {
            type: BuildIssueType.NoVendors
        });
        expect(result).toBe(existing);
    });
});

describe("clearBuildIssue", () => {
    it("removes issues with the given type", () => {
        const result = clearBuildIssue(
            [
                { type: BuildIssueType.ThumbnailFailed },
                { type: BuildIssueType.NoVendors }
            ],
            BuildIssueType.ThumbnailFailed
        );
        expect(result).toEqual([{ type: BuildIssueType.NoVendors }]);
    });

    it("returns an equivalent array when the type is absent", () => {
        const result = clearBuildIssue(
            [{ type: BuildIssueType.NoVendors }],
            BuildIssueType.ThumbnailFailed
        );
        expect(result).toEqual([{ type: BuildIssueType.NoVendors }]);
    });
});

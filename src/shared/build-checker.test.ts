import { describe, expect, it } from "vitest";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueCode,
    BuildIssueSeverity,
    clearBuildIssue,
    getMaxSeverity
} from "./build-checker";

/** A representative issue code for each severity. */
const CODE_BY_SEVERITY: Record<BuildIssueSeverity, BuildIssueCode> = {
    [BuildIssueSeverity.INFO]: BuildIssueCode.NoVendors,
    [BuildIssueSeverity.WARNING]: BuildIssueCode.NoThumbnailTab,
    [BuildIssueSeverity.ERROR]: BuildIssueCode.ThumbnailFailed
};

const issue = (severity: BuildIssueSeverity): BuildIssue => ({
    code: CODE_BY_SEVERITY[severity]
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
            code: BuildIssueCode.NoVendors
        });
        expect(result).toEqual([{ code: BuildIssueCode.NoVendors }]);
    });

    it("does not duplicate an issue with the same code", () => {
        const existing: BuildIssue[] = [{ code: BuildIssueCode.NoVendors }];
        const result = addBuildIssue(existing, {
            code: BuildIssueCode.NoVendors
        });
        expect(result).toBe(existing);
    });
});

describe("clearBuildIssue", () => {
    it("removes issues with the given code", () => {
        const result = clearBuildIssue(
            [
                { code: BuildIssueCode.ThumbnailFailed },
                { code: BuildIssueCode.NoVendors }
            ],
            BuildIssueCode.ThumbnailFailed
        );
        expect(result).toEqual([{ code: BuildIssueCode.NoVendors }]);
    });

    it("returns an equivalent array when the code is absent", () => {
        const result = clearBuildIssue(
            [{ code: BuildIssueCode.NoVendors }],
            BuildIssueCode.ThumbnailFailed
        );
        expect(result).toEqual([{ code: BuildIssueCode.NoVendors }]);
    });
});

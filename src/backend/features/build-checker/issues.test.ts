import { describe, expect, it } from "vitest";
import {
    addBuildIssue,
    hasBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    clearBuildIssue,
    getMaxSeverity
} from "./issues";

/** A representative issue type for each severity. */
const TYPE_BY_SEVERITY: Record<BuildIssueSeverity, BuildIssueType> = {
    [BuildIssueSeverity.INFO]: BuildIssueType.NO_VENDORS,
    [BuildIssueSeverity.WARNING]: BuildIssueType.NO_THUMBNAIL_TAB,
    [BuildIssueSeverity.ERROR]: BuildIssueType.THUMBNAIL_FAILED
};

const issue = (severity: BuildIssueSeverity): BuildIssue => ({
    type: TYPE_BY_SEVERITY[severity]
});

describe("getMaxSeverity", () => {
    it("returns null when there are no issues", () => {
        expect(getMaxSeverity([])).toBeNull();
    });

    const { INFO, WARNING, ERROR } = BuildIssueSeverity;
    it.each([
        [[INFO], INFO],
        [[INFO, WARNING], WARNING],
        [[INFO, ERROR, WARNING], ERROR]
    ])("takes the worst of %s", (severities, worst) => {
        expect(getMaxSeverity(severities.map(issue))).toBe(worst);
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
        expect(result).toEqual(existing);
    });

    // Callers hold onto the array they passed in, so it must never be the one
    // that comes back, even when there was nothing to add.
    it("returns a new array even when nothing is added", () => {
        const existing: BuildIssue[] = [{ type: BuildIssueType.NO_VENDORS }];
        expect(
            addBuildIssue(existing, { type: BuildIssueType.NO_VENDORS })
        ).not.toBe(existing);
        expect(addBuildIssue(existing)).not.toBe(existing);
    });
});

describe("hasBuildIssue", () => {
    const issues = [
        { type: BuildIssueType.NO_PARTS },
        { type: BuildIssueType.NO_VENDORS }
    ];

    it("finds one of the types asked for", () => {
        expect(hasBuildIssue(issues, BuildIssueType.NO_PARTS)).toBe(true);
        expect(
            hasBuildIssue(
                issues,
                BuildIssueType.LOAD_FAILED,
                BuildIssueType.NO_VENDORS
            )
        ).toBe(true);
    });

    it("finds none of them", () => {
        expect(hasBuildIssue(issues, BuildIssueType.LOAD_FAILED)).toBe(false);
        expect(hasBuildIssue([], BuildIssueType.NO_PARTS)).toBe(false);
        expect(hasBuildIssue(issues)).toBe(false);
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

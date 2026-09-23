import { describe, expect, it } from "vitest";
import {
    addBuildIssue,
    hasBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    clearBuildIssue,
    getIssueConfiguration,
    getIssueDescription,
    getMaxSeverity,
    knownBuildIssues
} from "./issues";

/** A representative issue type for each severity, each one payload-free. */
const TYPE_BY_SEVERITY = {
    [BuildIssueSeverity.INFO]: BuildIssueType.NO_VENDORS,
    [BuildIssueSeverity.WARNING]: BuildIssueType.NO_THUMBNAIL_TAB,
    [BuildIssueSeverity.ERROR]: BuildIssueType.THUMBNAIL_FAILED
} as const satisfies Record<BuildIssueSeverity, BuildIssueType>;

const issue = (severity: BuildIssueSeverity): BuildIssue => ({
    type: TYPE_BY_SEVERITY[severity]
});

describe("getIssueConfiguration", () => {
    it("names the configuration an issue blames", () => {
        expect(
            getIssueConfiguration({
                type: BuildIssueType.UNSTABLE_COMPOSITE,
                values: { size: "large" },
                configurationCount: 1
            })
        ).toEqual({ size: "large" });
    });

    it("names none where the element itself is at fault", () => {
        expect(
            getIssueConfiguration({ type: BuildIssueType.MULTIPLE_PARTS })
        ).toBeUndefined();
    });
});

describe("getIssueDescription", () => {
    // The count is the difference between "go fix this one" and "go fix forty".
    it.each([
        [1, "A configuration resolves to more than one part"],
        [4, "4 configurations resolve to more than one part"]
    ])("counts %i offending configurations", (count, expected) => {
        expect(
            getIssueDescription({
                type: BuildIssueType.CONFIGURATION_MULTIPLE_PARTS,
                values: { size: "large" },
                configurationCount: count
            })
        ).toBe(expected);
    });
});

describe("knownBuildIssues", () => {
    /** A type an older deploy stored, cast because this build no longer has it. */
    const retired = { type: "thumbnail-pending" } as unknown as BuildIssue;

    it("drops a type this build has no check for", () => {
        expect(
            knownBuildIssues([retired, { type: BuildIssueType.LOAD_FAILED }])
        ).toEqual([{ type: BuildIssueType.LOAD_FAILED }]);
    });

    it("keeps an issue stored before issues carried values, unlinked", () => {
        const stored = {
            type: BuildIssueType.UNSTABLE_COMPOSITE,
            configurationKey: "size=large",
            configurationCount: 2
        } as unknown as BuildIssue;
        const [kept] = knownBuildIssues([stored]);
        expect(kept.type).toBe(BuildIssueType.UNSTABLE_COMPOSITE);
        expect(getIssueConfiguration(kept)).toBeUndefined();
    });

    it("keeps every type it knows", () => {
        // Only the type is read, so the ones carrying a configuration stand up
        // bare here rather than being built twice.
        const issues = Object.values(BuildIssueType).map(
            (type) => ({ type }) as BuildIssue
        );
        expect(knownBuildIssues(issues)).toEqual(issues);
    });
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
    const issues: BuildIssue[] = [
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
        const issues: BuildIssue[] = [
            { type: BuildIssueType.THUMBNAIL_FAILED },
            { type: BuildIssueType.NO_VENDORS }
        ];
        const result = clearBuildIssue(issues, BuildIssueType.THUMBNAIL_FAILED);
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

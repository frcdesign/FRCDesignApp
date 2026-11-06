import { describe, expect, it } from "vitest";
import { BuildIssueType } from "@backend/features/build-checker/issues";
import { getIssueTitle } from "./issue-text";

describe("getIssueTitle", () => {
    // The count is the difference between "go fix this one" and "go fix forty".
    it.each([
        [1, "A configuration has more than one part"],
        [4, "4 configurations have more than one part"],
        [1200, "1,200 configurations have more than one part"]
    ])("counts %i offending configurations", (count, expected) => {
        expect(
            getIssueTitle({
                type: BuildIssueType.CONFIGURATION_MULTIPLE_PARTS,
                values: { size: "large" },
                configurationCount: count
            })
        ).toBe(expected);
    });
});

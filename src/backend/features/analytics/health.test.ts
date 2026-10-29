import { describe, expect, it } from "vitest";
import { BuildIssueType } from "../build-checker/issues";
import { summarizeHealth } from "./health";

describe("summarizeHealth", () => {
    const cleanGroup = { buildIssues: [] };
    const insertable = { buildIssues: [] };

    it("counts every issue, including a lesser one on the same item", () => {
        const counts = summarizeHealth(
            [cleanGroup],
            [
                insertable,
                {
                    buildIssues: [
                        { type: BuildIssueType.LOAD_FAILED },
                        { type: BuildIssueType.NO_VENDORS }
                    ]
                },
                {
                    // Info-only: unhealthy, but on neither tile.
                    buildIssues: [{ type: BuildIssueType.NO_THUMBNAIL_TAB }]
                }
            ]
        );

        expect(counts).toEqual({
            groupCount: 1,
            insertableCount: 3,
            errorCount: 1,
            warningCount: 1,
            healthyItems: 2
        });
    });

    it("counts issues, not items, so two on one part read as two", () => {
        const counts = summarizeHealth(
            [cleanGroup],
            [
                {
                    buildIssues: [
                        { type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED },
                        { type: BuildIssueType.MANUAL_INDEXING_REQUIRED }
                    ]
                }
            ]
        );

        expect(counts.warningCount).toBe(2);
        expect(counts.healthyItems).toBe(1); // the group
    });

    it("reports a group's stored issues without recomputing any", () => {
        const counts = summarizeHealth(
            [
                {
                    ...cleanGroup,
                    buildIssues: [
                        { type: BuildIssueType.NO_UNHIDDEN_INSERTABLES }
                    ]
                }
            ],
            []
        );

        expect(counts.errorCount).toBe(1);
        expect(counts.healthyItems).toBe(0);
    });
});

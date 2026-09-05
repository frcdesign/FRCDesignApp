import { describe, expect, it } from "vitest";
import { BuildIssueType } from "../build-checker/issues";
import { summarizeHealth } from "./health";

describe("summarizeHealth", () => {
    const cleanGroup = {
        id: "g1",
        buildIssues: [],
        lastLoadedAt: 1
    };
    const insertable = {
        id: "i1",
        groupId: "g1",
        buildIssues: [],
        lastLoadedAt: 1
    };

    it("counts every issue, including a lesser one on the same item", () => {
        const counts = summarizeHealth(
            [cleanGroup],
            [
                insertable,
                {
                    ...insertable,
                    id: "i2",
                    buildIssues: [
                        { type: BuildIssueType.LOAD_FAILED },
                        { type: BuildIssueType.NO_VENDORS }
                    ]
                },
                {
                    ...insertable,
                    id: "i3",
                    // Info-only, so it leaves the item unhealthy without
                    // landing on either tile.
                    buildIssues: [{ type: BuildIssueType.NO_THUMBNAIL_TAB }]
                }
            ],
            new Map()
        );

        expect(counts).toEqual({
            groupCount: 1,
            insertableCount: 3,
            errorCount: 1,
            warningCount: 1,
            healthyItems: 2
        });
    });

    it("counts an insertable's configuration issues as its own", () => {
        // The panel merges these, so the dashboard must not disagree.
        const counts = summarizeHealth(
            [cleanGroup],
            [insertable],
            new Map([
                ["i1", [{ type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }]]
            ])
        );

        expect(counts.warningCount).toBe(1);
        expect(counts.healthyItems).toBe(1); // the group
    });

    it("counts issues, not items, so two on one part read as two", () => {
        const counts = summarizeHealth(
            [cleanGroup],
            [insertable],
            new Map([
                [
                    "i1",
                    [
                        { type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED },
                        { type: BuildIssueType.MANUAL_INDEXING_REQUIRED }
                    ]
                ]
            ])
        );

        expect(counts.warningCount).toBe(2);
        expect(counts.healthyItems).toBe(1);
    });

    it("reports a group's stored issues without recomputing any", () => {
        // Visibility checks now run in the workflow and on the visibility
        // toggle, so this only reads what they wrote.
        const counts = summarizeHealth(
            [
                {
                    ...cleanGroup,
                    buildIssues: [
                        { type: BuildIssueType.NO_UNHIDDEN_INSERTABLES }
                    ]
                }
            ],
            [],
            new Map()
        );

        expect(counts.errorCount).toBe(1);
        expect(counts.healthyItems).toBe(0);
    });
});

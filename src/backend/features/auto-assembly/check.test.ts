import { describe, expect, it } from "vitest";
import { pickProblems } from "./check";
import {
    HoleStatus,
    type PlannedHole,
    type SelectedEntity,
    SelectedEntityType
} from "./contract";
import { type IndexedHoles } from "./index-holes";

const pick = (
    entityId: string,
    entityType = SelectedEntityType.EDGE
): SelectedEntity => ({ occurrencePath: ["plate"], entityId, entityType });

function indexed(overrides: Partial<IndexedHoles>): IndexedHoles {
    return {
        circularEdges: [],
        holes: [],
        placed: [],
        unfound: [],
        replacements: [],
        pickEdges: {},
        ...overrides
    };
}

const ready = (key: string): PlannedHole => ({
    key,
    status: HoleStatus.READY
});

describe("pickProblems", () => {
    it("says why a pick gave no hole, and nothing of one that plans ready", () => {
        expect(
            pickProblems(
                { targets: [pick("A"), pick("B")], excluded: [], replaced: [] },
                indexed({
                    unfound: [
                        {
                            key: "plate|A",
                            status: HoleStatus.NO_FIT,
                            reason: "Not a circular edge."
                        }
                    ],
                    pickEdges: { "plate|A": [], "plate|B": ["plate|B"] }
                }),
                [ready("plate|B")]
            )
        ).toEqual([{ key: "plate|A", message: "Not a circular edge." }]);
    });

    it("gives a hole's own reason, and counts a face's holes that won't fit", () => {
        const face = pick("F", SelectedEntityType.FACE);
        const problems = pickProblems(
            { targets: [pick("E"), face], excluded: [], replaced: [] },
            indexed({
                pickEdges: {
                    "plate|E": ["plate|E"],
                    "plate|F": ["plate|F1", "plate|F2"]
                }
            }),
            [
                { key: "plate|E", status: HoleStatus.FASTENED },
                ready("plate|F1"),
                {
                    key: "plate|F2",
                    status: HoleStatus.NO_FIT,
                    reason: "The hole is too small for a #10-32 screw."
                }
            ]
        );
        expect(problems).toEqual([
            {
                key: "plate|E",
                message:
                    "A library screw is already in this hole. Pick it under Screws to replace to change it."
            },
            {
                key: "plate|F",
                message:
                    "1 of 2 holes can't be fastened: The hole is too small for a #10-32 screw."
            }
        ]);
    });

    it("plans nothing without options, so only picks giving no hole are marked", () => {
        expect(
            pickProblems(
                { targets: [pick("E")], excluded: [], replaced: [] },
                indexed({ pickEdges: { "plate|E": ["plate|E"] } })
            )
        ).toEqual([]);
    });

    it("marks a hole to skip that isn't in the faces picked", () => {
        expect(
            pickProblems(
                {
                    targets: [pick("F", SelectedEntityType.FACE)],
                    excluded: [pick("IN"), pick("OUT")],
                    replaced: []
                },
                indexed({
                    pickEdges: {
                        "plate|F": ["plate|IN"],
                        "plate|IN": ["plate|IN"],
                        "plate|OUT": ["plate|OUT"]
                    }
                })
            )
        ).toEqual([
            { key: "plate|OUT", message: "Not a hole in the faces picked." }
        ]);
    });

    it("says a screw to replace stays when its hole won't plan", () => {
        expect(
            pickProblems(
                {
                    targets: [],
                    excluded: [],
                    replaced: [pick("S", SelectedEntityType.BODY)]
                },
                indexed({ pickEdges: { "plate|S": ["base|H"] } }),
                [
                    {
                        key: "base|H",
                        status: HoleStatus.NO_FIT,
                        reason: "No screw is long enough to reach through."
                    }
                ]
            )
        ).toEqual([
            {
                key: "plate|S",
                message:
                    "Its hole can't be fastened again, so it stays: No screw is long enough to reach through."
            }
        ]);
    });
});

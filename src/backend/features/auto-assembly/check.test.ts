import { describe, expect, it } from "vitest";
import { pickProblems } from "./check";
import {
    HoleStatus,
    type PlannedHole,
    ProblemSeverity,
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
        ).toEqual([
            {
                key: "plate|A",
                message: "Not a circular edge.",
                severity: ProblemSeverity.ERROR
            }
        ]);
    });

    it("gives a hole's own reason, counts a face's holes that won't fit, and warns of holes with screws already", () => {
        const face = pick("F", SelectedEntityType.FACE);
        const other = pick("G", SelectedEntityType.FACE);
        const problems = pickProblems(
            { targets: [pick("E"), face, other], excluded: [], replaced: [] },
            indexed({
                pickEdges: {
                    "plate|E": ["plate|E"],
                    "plate|F": ["plate|F1", "plate|F2"],
                    "plate|G": ["plate|G1", "plate|G2"]
                }
            }),
            [
                { key: "plate|E", status: HoleStatus.FASTENED },
                { key: "plate|G1", status: HoleStatus.FASTENED },
                ready("plate|G2"),
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
                message: "This hole already has a screw and will be ignored.",
                severity: ProblemSeverity.WARNING
            },
            {
                key: "plate|F",
                message:
                    "1 of 2 holes can't be fastened: The hole is too small for a #10-32 screw.",
                severity: ProblemSeverity.ERROR
            },
            {
                key: "plate|G",
                message: "Some holes already have screws and will be ignored.",
                severity: ProblemSeverity.WARNING
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
            {
                key: "plate|OUT",
                message: "Not a hole in the faces picked.",
                severity: ProblemSeverity.ERROR
            }
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
                    "Its hole can't be fastened again, so it stays: No screw is long enough to reach through.",
                severity: ProblemSeverity.ERROR
            }
        ]);
    });

    it("warns of a hole that plans ready with a warning, after any that won't fit", () => {
        const face = pick("F", SelectedEntityType.FACE);
        const warned = (key: string): PlannedHole => ({
            ...ready(key),
            warning:
                "The closest screw, 1/4 in, is 0.1 in too long, so it bottoms out in the hole."
        });
        const problems = pickProblems(
            { targets: [pick("E"), face], excluded: [], replaced: [] },
            indexed({
                pickEdges: {
                    "plate|E": ["plate|E"],
                    "plate|F": ["plate|F1", "plate|F2", "plate|F3"]
                }
            }),
            [
                warned("plate|E"),
                warned("plate|F1"),
                ready("plate|F2"),
                warned("plate|F3")
            ]
        );
        expect(problems).toEqual([
            {
                key: "plate|E",
                message:
                    "The closest screw, 1/4 in, is 0.1 in too long, so it bottoms out in the hole.",
                severity: ProblemSeverity.WARNING
            },
            {
                key: "plate|F",
                message:
                    "2 of 3 holes have a warning: The closest screw, 1/4 in, is 0.1 in too long, so it bottoms out in the hole.",
                severity: ProblemSeverity.WARNING
            }
        ]);
    });
});

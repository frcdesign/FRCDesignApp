import { describe, expect, it } from "vitest";
import { type AssemblyCircularEdge } from "./planner";
import { replicateMatch } from "./replicate";

function edge(
    key: string,
    radius: number,
    face?: string
): AssemblyCircularEdge {
    return {
        key,
        occurrencePath: ["plate"],
        edgeId: key,
        center: [0, 0, 0],
        normal: [0, 0, 1],
        radius,
        ...(face !== undefined && { face })
    };
}

describe("replicateMatch", () => {
    it("matches a whole face's edges of the seed's size", () => {
        const group = [edge("a", 1, "F"), edge("b", 1, "F")];
        const all = [...group, edge("c", 2, "F")];
        expect(replicateMatch(group, all)).toEqual({
            faces: [{ deterministicId: "F", path: ["plate"] }]
        });
    });

    it("matches edges alone where a face has an edge of the size the group leaves out", () => {
        // `c` is already fastened, or planned differently
        const group = [edge("a", 1, "F"), edge("b", 1, "F")];
        const all = [...group, edge("c", 1, "F")];
        expect(replicateMatch(group, all)).toEqual({
            edges: [{ deterministicId: "b", path: ["plate"] }]
        });
    });

    it("matches edges alone for edges picked one by one, or on a face with a hole skipped", () => {
        const group = [edge("a", 1, "F"), edge("b", 1)];
        expect(replicateMatch(group, group)).toEqual({
            edges: [{ deterministicId: "b", path: ["plate"] }]
        });
    });
});

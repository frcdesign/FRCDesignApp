import { describe, expect, it } from "vitest";
import { toWorkspacePath, type WorkspacePath } from "./contract";
import {
    downstreamOf,
    LinkCycleError,
    pushOrder,
    type WorkspaceEdge
} from "./graph";

/** A workspace named after its document, since the ids only have to differ. */
function ws(name: string): WorkspacePath {
    return toWorkspacePath(name, `${name}-w`);
}

function edge(source: string, target: string): WorkspaceEdge {
    return { source: ws(source), target: ws(target) };
}

/** What the order says, in the shorthand these tests are written in. */
function names(workspaces: WorkspacePath[]): string[] {
    return workspaces.map((workspace) => workspace.documentId);
}

describe("downstreamOf", () => {
    it("returns each workspace once, however many edges reach it", () => {
        const edges = [edge("a", "b"), edge("a", "b"), edge("a", "c")];
        expect(names(downstreamOf(edges, ws("a")))).toEqual(["b", "c"]);
    });
});

describe("pushOrder", () => {
    const chain = [edge("a", "b"), edge("b", "c")];

    it("stops at the direct consumers when not recursive", () => {
        expect(names(pushOrder(chain, ws("a"), false))).toEqual(["b"]);
    });

    it("walks the whole chain when recursive", () => {
        expect(names(pushOrder(chain, ws("a"), true))).toEqual(["b", "c"]);
    });

    it("puts a workspace after both of the ones feeding it", () => {
        // a feeds b and c, which both feed d.
        const diamond = [
            edge("a", "b"),
            edge("a", "c"),
            edge("b", "d"),
            edge("c", "d")
        ];
        const order = names(pushOrder(diamond, ws("a"), true));
        expect(order).toHaveLength(3);
        expect(order.indexOf("d")).toBeGreaterThan(order.indexOf("b"));
        expect(order.indexOf("d")).toBeGreaterThan(order.indexOf("c"));
    });

    it("leaves the root out of its own order", () => {
        expect(names(pushOrder(chain, ws("a"), true))).not.toContain("a");
    });

    it("is empty for a workspace nothing references", () => {
        expect(pushOrder(chain, ws("c"), true)).toEqual([]);
        expect(pushOrder([], ws("a"), false)).toEqual([]);
    });

    it("ignores links that do not lead back to the root", () => {
        // x feeds a, so it is upstream and has no part in pushing from a.
        const edges = [...chain, edge("x", "a")];
        expect(names(pushOrder(edges, ws("a"), true))).toEqual(["b", "c"]);
    });

    it("refuses a cycle, since there is no order to run one in", () => {
        const cycle = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
        expect(() => pushOrder(cycle, ws("a"), true)).toThrow(LinkCycleError);
    });

    it("pushes directly into a cycle it is not asked to walk", () => {
        const cycle = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
        expect(names(pushOrder(cycle, ws("a"), false))).toEqual(["b"]);
    });
});

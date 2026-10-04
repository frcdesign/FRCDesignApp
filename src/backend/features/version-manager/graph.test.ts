import { describe, expect, it } from "vitest";
import { toWorkspacePath, workspaceKey, type WorkspacePath } from "./contract";
import {
    ancestorKeys,
    childrenOf,
    descendantKeys,
    LinkCycleError,
    pullOrder,
    pushOrder,
    type WorkspaceEdge
} from "./graph";

/** A workspace named after its document, since the ids only have to differ. */
function ws(name: string): WorkspacePath {
    return toWorkspacePath(name, `${name}-w`);
}

function edge(parent: string, child: string): WorkspaceEdge {
    return { parent: ws(parent), child: ws(child) };
}

/** What the order says, in the shorthand these tests are written in. */
function names(workspaces: WorkspacePath[]): string[] {
    return workspaces.map((workspace) => workspace.documentId);
}

describe("childrenOf", () => {
    it("returns only the workspace's own children", () => {
        const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d")];
        expect(names(childrenOf(edges, ws("a")))).toEqual(["b", "c"]);
    });
});

describe("pushOrder", () => {
    const chain = [edge("a", "b"), edge("b", "c")];

    it("stops at the direct children when not recursive", () => {
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

describe("descendantKeys", () => {
    it("reaches everything below a workspace, through a diamond, and nothing beside it", () => {
        const edges = [
            edge("a", "b"),
            edge("a", "c"),
            edge("b", "d"),
            edge("c", "d"),
            edge("a", "e")
        ];
        expect(descendantKeys(edges, ws("b"))).toEqual(
            new Set([workspaceKey(ws("b")), workspaceKey(ws("d"))])
        );
    });
});

describe("pullOrder", () => {
    it("versions every parent above the root, each after its own parents", () => {
        // a feeds b and c, which both feed d.
        const diamond = [
            edge("a", "b"),
            edge("a", "c"),
            edge("b", "d"),
            edge("c", "d")
        ];
        const order = names(pullOrder(diamond, ws("d")));
        expect(order[0]).toBe("a");
        expect(order.slice(1).sort()).toEqual(["b", "c"]);
    });

    it("leaves out the root and anything beside or below it", () => {
        const edges = [edge("a", "b"), edge("b", "c"), edge("x", "c")];
        expect(names(pullOrder(edges, ws("b")))).toEqual(["a"]);
        expect(pullOrder(edges, ws("a"))).toEqual([]);
    });

    it("rejects a cycle above the root", () => {
        const cycle = [edge("a", "b"), edge("b", "a"), edge("b", "c")];
        expect(() => pullOrder(cycle, ws("c"))).toThrow(LinkCycleError);
    });
});

describe("ancestorKeys", () => {
    it("reaches everything above a workspace, and nothing beside it", () => {
        const edges = [edge("a", "b"), edge("b", "c"), edge("x", "c")];
        expect(ancestorKeys(edges, ws("b"))).toEqual(
            new Set([workspaceKey(ws("b")), workspaceKey(ws("a"))])
        );
    });
});

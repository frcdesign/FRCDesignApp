import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { LinkDirection, toWorkspacePath, type WorkspacePath } from "./contract";
import type { WorkspaceEdge } from "./graph";
import {
    addLink,
    collectEdges,
    deleteLink,
    getChildLinks,
    getLink,
    getParentLinks,
    otherEnd,
    reverseLink
} from "./links";
import { workspaceLinks } from "./schema";

const db = getDb(env.DB);

function ws(name: string): WorkspacePath {
    return toWorkspacePath(name, `${name}-w`);
}

beforeEach(async () => {
    await db.delete(workspaceLinks);
});

describe("links", () => {
    it("reads one row from either end", async () => {
        await addLink(db, ws("library"), ws("robot"));

        const asParent = await getChildLinks(db, ws("library"));
        const asChild = await getParentLinks(db, ws("robot"));
        expect(asParent).toHaveLength(1);
        expect(asChild).toHaveLength(1);
        expect(asParent[0].id).toBe(asChild[0].id);
    });

    it("does not answer the end a link does not touch", async () => {
        await addLink(db, ws("library"), ws("robot"));
        expect(await getParentLinks(db, ws("library"))).toEqual([]);
        expect(await getChildLinks(db, ws("robot"))).toEqual([]);
    });

    it("keeps one row when the same link is added twice", async () => {
        await addLink(db, ws("library"), ws("robot"));
        await addLink(db, ws("library"), ws("robot"));
        expect(await getChildLinks(db, ws("library"))).toHaveLength(1);
    });

    it("stores the two directions between a pair as separate rows", async () => {
        await addLink(db, ws("a"), ws("b"));
        await addLink(db, ws("b"), ws("a"));
        expect(await getChildLinks(db, ws("a"))).toHaveLength(1);
        expect(await getChildLinks(db, ws("b"))).toHaveLength(1);
    });

    it("tells a workspace apart from another workspace of its document", async () => {
        await addLink(db, ws("library"), ws("robot"));
        const otherBranch = { ...ws("library"), instanceId: "branch" };
        expect(await getChildLinks(db, otherBranch)).toEqual([]);
    });

    it("deletes by id", async () => {
        await addLink(db, ws("library"), ws("robot"));
        const [row] = await getChildLinks(db, ws("library"));

        await deleteLink(db, row.id);
        expect(await getLink(db, row.id)).toBeUndefined();
        expect(await getChildLinks(db, ws("library"))).toEqual([]);
    });

    it("turns a link around in place", async () => {
        await addLink(db, ws("library"), ws("robot"));
        const [row] = await getChildLinks(db, ws("library"));

        await reverseLink(db, row);

        expect(await getChildLinks(db, ws("library"))).toEqual([]);
        const reversed = await getChildLinks(db, ws("robot"));
        expect(reversed).toHaveLength(1);
        // The same row, so nothing that holds its id is left pointing at a
        // link that no longer exists.
        expect(reversed[0].id).toBe(row.id);
    });

    it("drops a link turned into one that already exists", async () => {
        await addLink(db, ws("a"), ws("b"));
        await addLink(db, ws("b"), ws("a"));
        const [row] = await getChildLinks(db, ws("a"));

        await reverseLink(db, row);

        expect(await getLink(db, row.id)).toBeUndefined();
        expect(await getChildLinks(db, ws("b"))).toHaveLength(1);
    });

    it("names the far end of a link", async () => {
        await addLink(db, ws("library"), ws("robot"));
        const [row] = await getChildLinks(db, ws("library"));
        expect(otherEnd(row, ws("library"))).toEqual(ws("robot"));
        expect(otherEnd(row, ws("robot"))).toEqual(ws("library"));
    });
});

const arrows = (edges: WorkspaceEdge[]) =>
    edges.map((e) => `${e.parent.documentId}->${e.child.documentId}`);

describe("collectEdges", () => {
    it("gathers the whole chain below a workspace", async () => {
        await addLink(db, ws("a"), ws("b"));
        await addLink(db, ws("b"), ws("c"));
        // A parent of the root, so no part of a push from it.
        await addLink(db, ws("x"), ws("a"));

        const edges = await collectEdges(db, ws("a"), LinkDirection.CHILD);
        expect(arrows(edges)).toEqual(["a->b", "b->c"]);
    });

    it("gathers the whole chain above a workspace", async () => {
        await addLink(db, ws("a"), ws("b"));
        await addLink(db, ws("b"), ws("c"));
        // A child of the root, so no part of a pull into it.
        await addLink(db, ws("c"), ws("x"));

        const edges = await collectEdges(db, ws("c"), LinkDirection.PARENT);
        expect(arrows(edges)).toEqual(["b->c", "a->b"]);
    });

    it("terminates on a cycle rather than walking it", async () => {
        await addLink(db, ws("a"), ws("b"));
        await addLink(db, ws("b"), ws("a"));

        const edges = await collectEdges(db, ws("a"), LinkDirection.CHILD);
        expect(edges).toHaveLength(2);
    });
});

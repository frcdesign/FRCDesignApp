/**
 * The link graph, as plain edges: who has to be updated before whom. Pure, so
 * the ordering a push depends on is testable without D1 or Onshape.
 */
import { isSameWorkspace, workspaceKey, type WorkspacePath } from "./contract";

/** One link: the parent provides the content, the child references it. */
export interface WorkspaceEdge {
    parent: WorkspacePath;
    child: WorkspacePath;
}

/** Thrown when a workspace's descendants lead back to it. */
export class LinkCycleError extends Error {
    constructor(readonly workspace: WorkspacePath) {
        super(
            `Linked workspaces form a cycle through ${workspaceKey(workspace)}.`
        );
        this.name = "LinkCycleError";
    }
}

/** The workspaces that reference `workspace` directly. */
export function childrenOf(
    edges: WorkspaceEdge[],
    workspace: WorkspacePath
): WorkspacePath[] {
    return edges
        .filter((edge) => isSameWorkspace(edge.parent, workspace))
        .map((edge) => edge.child);
}

/**
 * The workspaces a push from `root` updates, in order, `root` excluded. A
 * recursive push orders them topologically: a child of two of them waits for both.
 *
 * @throws {LinkCycleError} when the reachable subgraph has a cycle.
 */
export function pushOrder(
    edges: WorkspaceEdge[],
    root: WorkspacePath,
    recursive: boolean
): WorkspacePath[] {
    if (!recursive) {
        return childrenOf(edges, root);
    }

    const finished = new Set<string>();
    // Everything on the current path, which is what makes a back edge visible.
    const active = new Set<string>();
    const order: WorkspacePath[] = [];

    const visit = (workspace: WorkspacePath): void => {
        const key = workspaceKey(workspace);
        if (active.has(key)) {
            throw new LinkCycleError(workspace);
        }
        if (finished.has(key)) {
            return;
        }
        active.add(key);
        for (const next of childrenOf(edges, workspace)) {
            visit(next);
        }
        active.delete(key);
        finished.add(key);
        // Post-order, so a workspace lands before everything it references;
        // reversed below, which is the order they have to be updated in.
        order.push(workspace);
    };

    visit(root);
    order.reverse();
    // The root leads, having been visited last.
    return order.slice(1);
}

/**
 * `workspace` and everything below it, as a set of keys — what a push aimed at
 * one child keeps when it carries on recursively.
 */
export function descendantKeys(
    edges: WorkspaceEdge[],
    workspace: WorkspacePath
): Set<string> {
    const found = new Set<string>([workspaceKey(workspace)]);
    let frontier = [workspace];
    while (frontier.length > 0) {
        const next: WorkspacePath[] = [];
        for (const each of frontier) {
            for (const child of childrenOf(edges, each)) {
                const key = workspaceKey(child);
                if (found.has(key)) continue;
                found.add(key);
                next.push(child);
            }
        }
        frontier = next;
    }
    return found;
}

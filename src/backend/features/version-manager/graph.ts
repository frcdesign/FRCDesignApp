/**
 * The link graph, as plain edges: who has to be updated before whom. Pure, so
 * the ordering a push depends on is testable without D1 or Onshape.
 */
import { isSameWorkspace, type WorkspacePath } from "./contract";

export interface WorkspaceEdge {
    /** Provides the content. */
    source: WorkspacePath;
    /** References it. */
    target: WorkspacePath;
}

/** Thrown when the links downstream of a workspace lead back to it. */
export class LinkCycleError extends Error {
    constructor(readonly workspace: WorkspacePath) {
        super(
            `Linked workspaces form a cycle through ${workspace.documentId}/${workspace.instanceId}.`
        );
        this.name = "LinkCycleError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

function toKey(workspace: WorkspacePath): string {
    return `${workspace.documentId}|${workspace.instanceId}`;
}

/** The workspaces that reference `workspace` directly. */
export function downstreamOf(
    edges: WorkspaceEdge[],
    workspace: WorkspacePath
): WorkspacePath[] {
    const seen = new Set<string>();
    const found: WorkspacePath[] = [];
    for (const edge of edges) {
        if (!isSameWorkspace(edge.source, workspace)) continue;
        const key = toKey(edge.target);
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(edge.target);
    }
    return found;
}

/**
 * The workspaces a push from `root` has to update, in the order it has to
 * update them. `root` itself is not among them: it is versioned first, and
 * nothing in it changes.
 *
 * A direct push stops at the workspaces that reference `root`. A recursive one
 * carries on through everything reachable from it, ordered so a workspace comes
 * after every workspace in the run that it references — a workspace fed by two
 * of them has to wait for both, which is why this is a topological order and
 * not a breadth-first walk.
 *
 * @throws {LinkCycleError} when the reachable subgraph is not acyclic. There is
 * no order to run a cycle in, so the caller is told rather than left with a
 * partial one.
 */
export function pushOrder(
    edges: WorkspaceEdge[],
    root: WorkspacePath,
    recursive: boolean
): WorkspacePath[] {
    if (!recursive) {
        return downstreamOf(edges, root);
    }

    const finished = new Set<string>();
    // Everything on the current path, which is what makes a back edge visible.
    const active = new Set<string>();
    const order: WorkspacePath[] = [];

    const visit = (workspace: WorkspacePath): void => {
        const key = toKey(workspace);
        if (active.has(key)) {
            throw new LinkCycleError(workspace);
        }
        if (finished.has(key)) {
            return;
        }
        active.add(key);
        for (const next of downstreamOf(edges, workspace)) {
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

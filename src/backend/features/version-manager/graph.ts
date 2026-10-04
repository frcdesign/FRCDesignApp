/**
 * The link graph, as plain edges: who has to be updated before whom. Pure, so
 * the ordering a run depends on is testable without D1 or Onshape.
 */
import { isSameWorkspace, workspaceKey, type WorkspacePath } from "./contract";

/** One link: the parent provides the content, the child references it. */
export interface WorkspaceEdge {
    parent: WorkspacePath;
    child: WorkspacePath;
}

/** Thrown when following links from a workspace leads back to it. */
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

/** The workspaces `workspace` references directly. */
export function parentsOf(
    edges: WorkspaceEdge[],
    workspace: WorkspacePath
): WorkspacePath[] {
    return edges
        .filter((edge) => isSameWorkspace(edge.child, workspace))
        .map((edge) => edge.parent);
}

type Step = (workspace: WorkspacePath) => WorkspacePath[];

/**
 * Everything reachable from `root` by `next`, `root` included, each after
 * every workspace it reaches.
 *
 * @throws {LinkCycleError} when the reachable subgraph has a cycle.
 */
function postOrder(root: WorkspacePath, next: Step): WorkspacePath[] {
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
        for (const each of next(workspace)) {
            visit(each);
        }
        active.delete(key);
        finished.add(key);
        order.push(workspace);
    };

    visit(root);
    return order;
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
    // Reversed, so each comes before what references it; the root leads.
    return postOrder(root, (each) => childrenOf(edges, each))
        .reverse()
        .slice(1);
}

/**
 * The workspaces above `root` that a recursive pull versions, `root` excluded:
 * each after all of its own parents, whose new versions it is moved onto.
 *
 * @throws {LinkCycleError} when the reachable subgraph has a cycle.
 */
export function pullOrder(
    edges: WorkspaceEdge[],
    root: WorkspacePath
): WorkspacePath[] {
    // The root comes last, having been visited first.
    return postOrder(root, (each) => parentsOf(edges, each)).slice(0, -1);
}

/** `workspace` and everything reachable from it by `next`, as a set of keys. */
function reachableKeys(workspace: WorkspacePath, next: Step): Set<string> {
    const found = new Set<string>([workspaceKey(workspace)]);
    let frontier = [workspace];
    while (frontier.length > 0) {
        const reached: WorkspacePath[] = [];
        for (const each of frontier) {
            for (const other of next(each)) {
                const key = workspaceKey(other);
                if (found.has(key)) continue;
                found.add(key);
                reached.push(other);
            }
        }
        frontier = reached;
    }
    return found;
}

/**
 * `workspace` and everything below it — what a push aimed at one child keeps
 * when it carries on recursively.
 */
export function descendantKeys(
    edges: WorkspaceEdge[],
    workspace: WorkspacePath
): Set<string> {
    return reachableKeys(workspace, (each) => childrenOf(edges, each));
}

/**
 * `workspace` and everything above it — what a pull from one parent keeps
 * when it carries on recursively.
 */
export function ancestorKeys(
    edges: WorkspaceEdge[],
    workspace: WorkspacePath
): Set<string> {
    return reachableKeys(workspace, (each) => parentsOf(edges, each));
}

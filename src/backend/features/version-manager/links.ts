/**
 * Reading and writing links, and resolving one into what the client shows.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getDocument,
    getInsertables,
    getWorkspaces
} from "../../lib/onshape/endpoints/documents";
import {
    hasPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import {
    isSameWorkspace,
    type LinkedWorkspace,
    toWorkspacePath,
    type WorkspacePath
} from "./contract";
import type { WorkspaceEdge } from "./graph";
import { workspaceLinks, type WorkspaceLinkRow } from "./schema";

/** How far a push is allowed to walk, so a mislinked graph cannot run forever. */
const MAX_LINKED_WORKSPACES = 100;

export function toEdge(row: WorkspaceLinkRow): WorkspaceEdge {
    return {
        parent: toWorkspacePath(row.sourceDocumentId, row.sourceWorkspaceId),
        child: toWorkspacePath(row.targetDocumentId, row.targetWorkspaceId)
    };
}

/** The links to the workspaces `workspace` provides content to. */
export function getChildLinks(
    db: Db,
    workspace: WorkspacePath
): Promise<WorkspaceLinkRow[]> {
    return db
        .select()
        .from(workspaceLinks)
        .where(
            and(
                eq(workspaceLinks.sourceDocumentId, workspace.documentId),
                eq(workspaceLinks.sourceWorkspaceId, workspace.instanceId)
            )
        )
        .all();
}

/** The links to the workspaces `workspace` takes content from. */
export function getParentLinks(
    db: Db,
    workspace: WorkspacePath
): Promise<WorkspaceLinkRow[]> {
    return db
        .select()
        .from(workspaceLinks)
        .where(
            and(
                eq(workspaceLinks.targetDocumentId, workspace.documentId),
                eq(workspaceLinks.targetWorkspaceId, workspace.instanceId)
            )
        )
        .all();
}

export function getLink(
    db: Db,
    linkId: string
): Promise<WorkspaceLinkRow | undefined> {
    return db
        .select()
        .from(workspaceLinks)
        .where(eq(workspaceLinks.id, linkId))
        .get();
}

/**
 * Adds the edge, or leaves the existing one alone. Adding a link twice is the
 * same request twice, not an error worth showing anyone.
 */
export async function addLink(
    db: Db,
    parent: WorkspacePath,
    child: WorkspacePath
): Promise<void> {
    await db
        .insert(workspaceLinks)
        .values({
            sourceDocumentId: parent.documentId,
            sourceWorkspaceId: parent.instanceId,
            targetDocumentId: child.documentId,
            targetWorkspaceId: child.instanceId,
            createdAt: new Date()
        })
        .onConflictDoNothing();
}

/** The row for one edge, in the direction given. */
export function findLink(
    db: Db,
    parent: WorkspacePath,
    child: WorkspacePath
): Promise<WorkspaceLinkRow | undefined> {
    return db
        .select()
        .from(workspaceLinks)
        .where(
            and(
                eq(workspaceLinks.sourceDocumentId, parent.documentId),
                eq(workspaceLinks.sourceWorkspaceId, parent.instanceId),
                eq(workspaceLinks.targetDocumentId, child.documentId),
                eq(workspaceLinks.targetWorkspaceId, child.instanceId)
            )
        )
        .get();
}

/**
 * Turns an edge around, so what provided content now takes it. The row is
 * rewritten rather than deleted and re-added: one row is one edge, and a delete
 * whose insert did not land would lose the link.
 */
export async function reverseLink(
    db: Db,
    row: WorkspaceLinkRow
): Promise<void> {
    const { parent, child } = toEdge(row);
    // Two workspaces can each provide to the other, and a row is unique across
    // its four ids — so where the reverse is already there, turning this one
    // around would collide with it. Dropping it leaves what was asked for.
    if (await findLink(db, child, parent)) {
        await deleteLink(db, row.id);
        return;
    }

    await db
        .update(workspaceLinks)
        .set({
            sourceDocumentId: row.targetDocumentId,
            sourceWorkspaceId: row.targetWorkspaceId,
            targetDocumentId: row.sourceDocumentId,
            targetWorkspaceId: row.sourceWorkspaceId
        })
        .where(eq(workspaceLinks.id, row.id));
}

export async function deleteLink(db: Db, linkId: string): Promise<void> {
    await db.delete(workspaceLinks).where(eq(workspaceLinks.id, linkId));
}

/**
 * The edges below `root`, gathered a frontier at a time so a push reads the
 * part of the graph it is going to walk rather than the whole table.
 *
 * Revisits are skipped, so a cycle terminates here and is reported by
 * `pushOrder`, which is where an order would have to exist for one.
 */
export async function collectDescendantEdges(
    db: Db,
    root: WorkspacePath
): Promise<WorkspaceEdge[]> {
    const edges: WorkspaceEdge[] = [];
    const visited = new Set<string>();
    let frontier: WorkspacePath[] = [root];

    while (frontier.length > 0) {
        const next: WorkspacePath[] = [];
        for (const workspace of frontier) {
            const key = `${workspace.documentId}|${workspace.instanceId}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (visited.size > MAX_LINKED_WORKSPACES) {
                throw new Error(
                    `More than ${MAX_LINKED_WORKSPACES} workspaces linked below ${root.documentId}`
                );
            }
            const rows = await getChildLinks(db, workspace);
            for (const row of rows) {
                const edge = toEdge(row);
                edges.push(edge);
                next.push(edge.child);
            }
        }
        frontier = next;
    }
    return edges;
}

/**
 * Fills in what the client shows for a linked workspace: its names, and whether
 * the caller may read it at all.
 *
 * A workspace the caller cannot read comes back openable-false and unnamed —
 * they are being shown that a link exists, not what it points at. Whether they
 * may *write* to it is not asked here: the push route checks that across the
 * whole run before it starts, so a row that cannot be pushed to says so when it
 * is pushed to rather than sitting there greyed out.
 */
export async function toLinkedWorkspace(
    client: OnshapeApi,
    linkId: string,
    workspace: WorkspacePath,
    /** Parents only; see {@link LinkedWorkspace.unversionedChanges}. */
    countChanges = false
): Promise<LinkedWorkspace> {
    if (!(await hasPermissions(client, workspace, OnshapePermission.READ))) {
        return { linkId, workspace, isOpenable: false };
    }

    try {
        const document = await getDocument(client, workspace);
        const [workspaceName, unversionedChanges] = await Promise.all([
            getWorkspaceName(client, workspace, document),
            countChanges
                ? countUnversionedChanges(client, workspace)
                : undefined
        ]);
        return {
            linkId,
            workspace,
            isOpenable: true,
            documentName: document.name,
            workspaceName,
            unversionedChanges
        };
    } catch (error) {
        // Readable a moment ago and not now, or a document that has since been
        // deleted: the link is still real, so show it without the names.
        console.warn(`Failed to describe linked workspace ${linkId}`, error);
        return { linkId, workspace, isOpenable: false };
    }
}

/**
 * What the workspace has changed since its own last version. Counted rather
 * than failed on: a parent Onshape will not answer for is a row without a
 * badge, not a list that does not render.
 */
async function countUnversionedChanges(
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<number | undefined> {
    try {
        // No `include` flags: they all default to false, so this asks Onshape
        // to enumerate nothing and answer the counters.
        const insertables = await getInsertables(client, workspace);
        return insertables.changesSinceVersionSave;
    } catch (error) {
        console.warn(
            `Failed to count changes in ${workspace.documentId}`,
            error
        );
        return undefined;
    }
}

/**
 * The workspace's own name. The document already carries the default
 * workspace's, which is the common case and saves the second call.
 */
async function getWorkspaceName(
    client: OnshapeApi,
    workspace: WorkspacePath,
    document: { defaultWorkspace?: { id: string; name?: string } }
): Promise<string | undefined> {
    const { defaultWorkspace } = document;
    if (defaultWorkspace?.id === workspace.instanceId) {
        return defaultWorkspace.name;
    }
    const workspaces = await getWorkspaces(client, workspace);
    return workspaces.find((each) => each.id === workspace.instanceId)?.name;
}

/** The other end of a link from `workspace`'s point of view. */
export function otherEnd(
    row: WorkspaceLinkRow,
    workspace: WorkspacePath
): WorkspacePath {
    const { parent, child } = toEdge(row);
    return isSameWorkspace(parent, workspace) ? child : parent;
}

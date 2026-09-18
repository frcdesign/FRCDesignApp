/**
 * Reading and writing links, and resolving one into what the client shows.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getDocument,
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
 * the caller may read it and write to it.
 *
 * A workspace the caller cannot read comes back openable-false and unnamed —
 * they are being shown that a link exists, not what it points at.
 */
export async function toLinkedWorkspace(
    client: OnshapeApi,
    linkId: string,
    workspace: WorkspacePath
): Promise<LinkedWorkspace> {
    const [canRead, canPush] = await Promise.all([
        hasPermissions(client, workspace, OnshapePermission.READ),
        hasPermissions(
            client,
            workspace,
            OnshapePermission.WRITE,
            OnshapePermission.LINK
        )
    ]);
    if (!canRead) {
        return { linkId, workspace, isOpenable: false, canPush: false };
    }

    try {
        const document = await getDocument(client, workspace);
        return {
            linkId,
            workspace,
            isOpenable: true,
            canPush,
            documentName: document.name,
            workspaceName: await getWorkspaceName(client, workspace, document)
        };
    } catch (error) {
        // Readable a moment ago and not now, or a document that has since been
        // deleted: the link is still real, so show it without the names.
        console.warn(`Failed to describe linked workspace ${linkId}`, error);
        return { linkId, workspace, isOpenable: false, canPush: false };
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

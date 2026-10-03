/** Reading and writing links, and resolving one into what the client shows. */
import { and, eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import type { Db } from "../../db/client";
import type { OnshapeApi } from "../../lib/onshape/client";
import type { AppContext } from "../../lib/context";
import {
    hasPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import {
    isSameWorkspace,
    type LinkedWorkspace,
    toWorkspacePath,
    workspaceKey,
    type WorkspacePath
} from "./contract";
import type { WorkspaceEdge } from "./graph";
import { workspaceLinks, type WorkspaceLinkRow } from "./schema";
import { describeWorkspace, getUnversionedChanges } from "./workspace-cache";

/** The most workspaces a recursive push reaches. */
const MAX_LINKED_WORKSPACES = 100;

export function toEdge(row: WorkspaceLinkRow): WorkspaceEdge {
    return {
        parent: toWorkspacePath(row.sourceDocumentId, row.sourceWorkspaceId),
        child: toWorkspacePath(row.targetDocumentId, row.targetWorkspaceId)
    };
}

function isParent(workspace: WorkspacePath) {
    return and(
        eq(workspaceLinks.sourceDocumentId, workspace.documentId),
        eq(workspaceLinks.sourceWorkspaceId, workspace.instanceId)
    );
}

function isChild(workspace: WorkspacePath) {
    return and(
        eq(workspaceLinks.targetDocumentId, workspace.documentId),
        eq(workspaceLinks.targetWorkspaceId, workspace.instanceId)
    );
}

/** The links to the workspaces `workspace` provides content to. */
export function getChildLinks(
    db: Db,
    workspace: WorkspacePath
): Promise<WorkspaceLinkRow[]> {
    return db.select().from(workspaceLinks).where(isParent(workspace)).all();
}

/** The links to the workspaces `workspace` takes content from. */
export function getParentLinks(
    db: Db,
    workspace: WorkspacePath
): Promise<WorkspaceLinkRow[]> {
    return db.select().from(workspaceLinks).where(isChild(workspace)).all();
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
function findLink(
    db: Db,
    parent: WorkspacePath,
    child: WorkspacePath
): Promise<WorkspaceLinkRow | undefined> {
    return db
        .select()
        .from(workspaceLinks)
        .where(and(isParent(parent), isChild(child)))
        .get();
}

/**
 * Turns an edge around, so what provided content now takes it. Rewritten in
 * place, so the link cannot be lost halfway.
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
 * The edges below `root`, gathered a frontier at a time. Revisits are skipped,
 * so a cycle ends the walk here and `pushOrder` reports it.
 */
export async function collectDescendantEdges(
    db: Db,
    root: WorkspacePath
): Promise<WorkspaceEdge[]> {
    const edges: WorkspaceEdge[] = [];
    const visited = new Set<string>();
    let frontier: WorkspacePath[] = [root];

    while (frontier.length > 0) {
        const unvisited = frontier.filter((workspace) => {
            const key = workspaceKey(workspace);
            if (visited.has(key)) {
                return false;
            }
            visited.add(key);
            return true;
        });
        if (visited.size > MAX_LINKED_WORKSPACES) {
            throw handledError(
                `A push can reach at most ${MAX_LINKED_WORKSPACES} linked workspaces.`,
                HttpStatus.CONFLICT
            );
        }
        const rows = await Promise.all(
            unvisited.map((workspace) => getChildLinks(db, workspace))
        );
        const level = rows.flat().map(toEdge);
        edges.push(...level);
        frontier = level.map((edge) => edge.child);
    }
    return edges;
}

/**
 * What the client shows for a linked workspace. One the caller cannot read
 * comes back unopenable and unnamed: they see that a link exists, not where.
 */
export async function toLinkedWorkspace(
    c: AppContext,
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
        const [description, unversionedChanges] = await Promise.all([
            describeWorkspace(c, client, workspace),
            countChanges
                ? countUnversionedChanges(c, client, workspace)
                : undefined
        ]);
        return {
            linkId,
            workspace,
            isOpenable: true,
            ...description,
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
    c: AppContext,
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<number | undefined> {
    try {
        return await getUnversionedChanges(c, client, workspace);
    } catch (error) {
        console.warn(
            `Failed to count changes in ${workspace.documentId}`,
            error
        );
        return undefined;
    }
}

/** The other end of a link from `workspace`'s point of view. */
export function otherEnd(
    row: WorkspaceLinkRow,
    workspace: WorkspacePath
): WorkspacePath {
    const { parent, child } = toEdge(row);
    return isSameWorkspace(parent, workspace) ? child : parent;
}

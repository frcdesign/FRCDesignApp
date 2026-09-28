/**
 * Each document gets a workspace to read thumbnails from: Onshape sometimes
 * never renders them in a version, and the document's own workspace drifts.
 * Each new version gets a fresh one branched off it, and the old one is
 * deleted once nothing reads it, so the document keeps no branches of ours. A
 * new branch takes minutes to render.
 */
import { type OnshapeApi } from "../../lib/onshape/client";
import { type DocumentPath, type InstancePath } from "../../lib/onshape/path";
import {
    createWorkspace,
    deleteWorkspace,
    getWorkspaces
} from "../../lib/onshape/endpoints/workspaces";
import { type OnshapeWorkspaceInfo } from "../../lib/onshape/types";

/** Cleanup deletes nothing without it. */
const WORKSPACE_NAME = "FRCDesignApp Thumbnails (DO NOT EDIT)";

function isOurs(workspace: OnshapeWorkspaceInfo): boolean {
    return workspace.name === WORKSPACE_NAME;
}

/** Names the version, so a load of it finds the workspace already made. */
export function thumbnailWorkspaceDescription(versionId: string): string {
    return `Made by the FRCDesignApp to read thumbnails from version ${versionId}.`;
}

/**
 * A workspace of ours branched off `versionPath`, made if there isn't one.
 * Shared by every group of the document and by a retried step.
 */
export async function syncThumbnailWorkspace(
    client: OnshapeApi,
    versionPath: InstancePath
): Promise<InstancePath> {
    const description = thumbnailWorkspaceDescription(versionPath.instanceId);
    const existing = (await getWorkspaces(client, versionPath)).find(
        (workspace) =>
            isOurs(workspace) && workspace.description === description
    );
    const workspace =
        existing ??
        (await createWorkspace(client, versionPath, {
            name: WORKSPACE_NAME,
            description,
            versionId: versionPath.instanceId
        }));
    return toWorkspacePath(versionPath, workspace.id);
}

function toWorkspacePath(
    document: DocumentPath,
    workspaceId: string
): InstancePath {
    return {
        documentId: document.documentId,
        instanceId: workspaceId,
        instanceType: "w"
    };
}

/**
 * Every workspace of ours no group names. A group in another library can be
 * pinned to an older version, held for approval, and still read from its own.
 */
export async function deleteStaleThumbnailWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath,
    keepWorkspaceIds: ReadonlySet<string>
): Promise<void> {
    const stale = (await getWorkspaces(client, documentPath)).filter(
        (workspace) => isOurs(workspace) && !keepWorkspaceIds.has(workspace.id)
    );
    for (const workspace of stale) {
        await deleteWorkspace(client, documentPath, workspace.id);
    }
}

/**
 * Each document gets one workspace to read thumbnails from: Onshape sometimes
 * never renders them in a version, and the document's own workspace drifts.
 * A new version is restored into it rather than branched, so the document's
 * history gains a microversion, not a branch. Restored content takes minutes
 * to render.
 */
import { type OnshapeApi } from "../../lib/onshape/client";
import { type DocumentPath, type InstancePath } from "../../lib/onshape/path";
import {
    createWorkspace,
    deleteWorkspace,
    getWorkspaces,
    restoreVersion
} from "../../lib/onshape/endpoints/workspaces";
import { type OnshapeWorkspaceInfo } from "../../lib/onshape/types";

/** Cleanup deletes nothing without it. */
const WORKSPACE_NAME = "FRCDesignApp Thumbnails (DO NOT EDIT)";
const WORKSPACE_DESCRIPTION =
    "Made by the FRCDesignApp to read the latest version's thumbnails from.";

function isOurs(workspace: OnshapeWorkspaceInfo): boolean {
    return workspace.name === WORKSPACE_NAME;
}

/** What the group row says its workspace holds. */
export interface StoredThumbnailWorkspace {
    workspaceId: string;
    versionId: string;
}

/**
 * The document's thumbnail workspace, holding `versionPath`'s content. Skips
 * the restore when the row says it already holds this version.
 */
export async function syncThumbnailWorkspace(
    client: OnshapeApi,
    versionPath: InstancePath,
    stored?: StoredThumbnailWorkspace
): Promise<InstancePath> {
    // The lowest id, so every group of a document settles on the same one.
    const existing = (await getWorkspaces(client, versionPath))
        .filter(isOurs)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!existing) {
        const created = await createWorkspace(client, versionPath, {
            name: WORKSPACE_NAME,
            description: WORKSPACE_DESCRIPTION,
            versionId: versionPath.instanceId
        });
        return toWorkspacePath(versionPath, created.id);
    }
    const workspacePath = toWorkspacePath(versionPath, existing.id);
    const holdsVersion =
        existing.id === stored?.workspaceId &&
        versionPath.instanceId === stored.versionId;
    if (!holdsVersion) {
        await restoreVersion(client, workspacePath, versionPath.instanceId);
    }
    return workspacePath;
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

/** Every other workspace of ours, which no load reads from any more. */
export async function deleteStaleThumbnailWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath,
    keepWorkspaceId: string
): Promise<void> {
    const stale = (await getWorkspaces(client, documentPath)).filter(
        (workspace) => isOurs(workspace) && workspace.id !== keepWorkspaceId
    );
    for (const workspace of stale) {
        await deleteWorkspace(client, documentPath, workspace.id);
    }
}

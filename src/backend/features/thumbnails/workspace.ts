/**
 * Each loaded version gets a branched workspace to read thumbnails from:
 * Onshape sometimes never renders them in a version, and the document's own
 * workspace drifts. A fresh branch takes minutes to render.
 */
import { type OnshapeApi } from "../../lib/onshape/client";
import { type DocumentPath, type InstancePath } from "../../lib/onshape/path";
import {
    createWorkspace,
    deleteWorkspace,
    getWorkspaces
} from "../../lib/onshape/endpoints/workspaces";
import { type OnshapeWorkspaceInfo } from "../../lib/onshape/types";

/** Shared by every branch; cleanup deletes nothing without it. */
const WORKSPACE_NAME = "FRCDesignApp Thumbnails (DO NOT EDIT)";

/** Records which version the branch came from; the name is the same for all. */
function workspaceDescription(versionId: string): string {
    return `Made by the FRCDesignApp to read version ${versionId}'s thumbnails from.`;
}

function isOurs(workspace: OnshapeWorkspaceInfo): boolean {
    return workspace.name === WORKSPACE_NAME;
}

/** Reuses an existing branch, so a retry doesn't make another. */
export async function ensureThumbnailWorkspace(
    client: OnshapeApi,
    versionPath: InstancePath
): Promise<InstancePath> {
    const description = workspaceDescription(versionPath.instanceId);
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
    return {
        documentId: versionPath.documentId,
        instanceId: workspace.id,
        instanceType: "w"
    };
}

/** Only safe once the group row has moved to `keepWorkspaceId`'s version. */
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

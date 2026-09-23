/**
 * Onshape sometimes never renders an element's thumbnail in a version, and the
 * document's own workspace drifts from the version the library shows. So each
 * loaded version gets a workspace branched off it, which nobody edits, and its
 * thumbnails are read from there.
 *
 * A fresh branch has no thumbnails for a few minutes, which is why a load
 * reading them retries for a long while.
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

/**
 * The name is the same for every version, so the description is what records
 * which one a branch came from.
 */
function workspaceDescription(versionId: string): string {
    return `Made by the FRCDesignApp to read version ${versionId}'s thumbnails from.`;
}

function isOurs(workspace: OnshapeWorkspaceInfo): boolean {
    return workspace.name === WORKSPACE_NAME;
}

/**
 * Found before it is created, so a retried step or a forced reload reuses the
 * branch rather than making another.
 */
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

/**
 * Deletes our branches of other versions. Only safe once the group row has
 * moved to `keepWorkspaceId`'s version, since renders read the stored branch.
 */
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

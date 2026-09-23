/**
 * The workspace thumbnails are read from.
 *
 * Onshape sometimes never renders an element's thumbnail in a version — a bug
 * on their side, as far as we can tell — while a workspace does render it. The
 * document's own workspace would, but it moves on from the version the library
 * shows, so its pictures can be of a part nobody can insert. So each version
 * gets a workspace branched off it, which nobody edits, and every thumbnail of
 * that version is read from there.
 *
 * A fresh branch has no thumbnails yet; Onshape renders them over the next few
 * minutes, which is why a load reading them retries for a long while.
 */
import { type OnshapeApi } from "../../lib/onshape/client";
import { type DocumentPath, type InstancePath } from "../../lib/onshape/path";
import {
    createWorkspace,
    deleteWorkspace,
    getWorkspaces
} from "../../lib/onshape/endpoints/workspaces";

/** Marks a workspace as ours, so cleanup never touches one it did not make. */
const NAME_PREFIX = "FRCDesignApp thumbnails";

/** Named by the version it is branched from, which is what finds it again. */
function workspaceName(versionId: string): string {
    return `${NAME_PREFIX} ${versionId}`;
}

/**
 * The version's thumbnail workspace, branched on first use. Found by name
 * rather than created blind, so a retried step or a forced reload reuses the
 * branch it already made.
 */
export async function ensureThumbnailWorkspace(
    client: OnshapeApi,
    versionPath: InstancePath
): Promise<InstancePath> {
    const name = workspaceName(versionPath.instanceId);
    const existing = (await getWorkspaces(client, versionPath)).find(
        (workspace) => workspace.name === name
    );
    const workspace =
        existing ??
        (await createWorkspace(client, versionPath, {
            name,
            description:
                "Made by the FRCDesignApp to read this version's thumbnails from. " +
                "Safe to delete; the app branches another when it needs one.",
            versionId: versionPath.instanceId
        }));
    return {
        documentId: versionPath.documentId,
        instanceId: workspace.id,
        instanceType: "w"
    };
}

/**
 * Deletes the thumbnail workspaces of other versions, once nothing reads from
 * them: a load that moved the group to a newer version reads from the newer
 * one's. Only ours, by name.
 */
export async function deleteStaleThumbnailWorkspaces(
    client: OnshapeApi,
    documentPath: DocumentPath,
    keepWorkspaceId: string
): Promise<void> {
    const stale = (await getWorkspaces(client, documentPath)).filter(
        (workspace) =>
            workspace.name.startsWith(NAME_PREFIX) &&
            workspace.id !== keepWorkspaceId
    );
    for (const workspace of stale) {
        await deleteWorkspace(client, documentPath, workspace.id);
    }
}

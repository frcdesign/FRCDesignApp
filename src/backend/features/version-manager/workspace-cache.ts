/**
 * A linked workspace's names and unversioned changes, cached as `units.ts`
 * caches units: a transient webhook drops the entries, and they expire in case
 * Onshape drops the webhook. Nothing caller-specific is stored.
 */
import type { AppContext } from "../../lib/context";
import type { InstancePath } from "../../lib/onshape/path";
import { runInBackground } from "../../lib/background";
import { kvStore } from "../../lib/kv-store";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getDocument,
    getInsertables
} from "../../lib/onshape/endpoints/documents";
import { getWorkspaces } from "../../lib/onshape/endpoints/workspaces";
import { watchLinkedWorkspace } from "../webhooks/transient";
import { workspaceKey, type WorkspacePath } from "./contract";

/** What the list shows of a workspace, minus what the caller may do with it. */
interface WorkspaceDescription {
    documentName?: string;
    workspaceName?: string;
}

/** Long, as a rename is heard about by webhook. */
const DESCRIPTION_TTL_SECONDS = 7 * 24 * 3600;

/** Shorter than a name's: an edit is ordinary where a rename is not. */
const CHANGES_TTL_SECONDS = 3600;

const descriptions = kvStore<WorkspaceDescription>("linked-workspace", {
    ttlSeconds: DESCRIPTION_TTL_SECONDS
});

/** Boxed, so a cached zero is a hit rather than a miss. */
const changeCounts = kvStore<{ changes: number }>("linked-workspace-changes", {
    ttlSeconds: CHANGES_TTL_SECONDS
});

/** Both entries for a workspace, dropped when its webhook says it changed. */
export async function forgetWorkspace(
    kv: KVNamespace,
    workspace: InstancePath
): Promise<void> {
    const id = workspaceKey(workspace);
    await Promise.all([
        descriptions.delete(kv, id),
        changeCounts.delete(kv, id)
    ]);
}

/** Best effort: a webhook that can't be registered leaves the expiry. */
function watch(
    c: AppContext,
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<void> {
    return runInBackground(c, "watch a linked workspace", () =>
        watchLinkedWorkspace(client, workspace, c.env.APP_URL)
    );
}

/** The document and workspace names, which is all the row shows. */
export async function describeWorkspace(
    c: AppContext,
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<WorkspaceDescription> {
    const id = workspaceKey(workspace);
    const cached = await descriptions.get(c.env.KV, id);
    if (cached) {
        return cached;
    }

    const [document, workspaces] = await Promise.all([
        getDocument(client, workspace),
        getWorkspaces(client, workspace)
    ]);
    const description: WorkspaceDescription = {
        documentName: document.name,
        workspaceName: workspaces.find(
            (each) => each.id === workspace.instanceId
        )?.name
    };

    await descriptions.put(c.env.KV, id, description);
    await watch(c, client, workspace);
    return description;
}

/** Edits since the workspace's own last version, or undefined where Onshape didn't say. */
export async function getUnversionedChanges(
    c: AppContext,
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<number | undefined> {
    const id = workspaceKey(workspace);
    const cached = await changeCounts.get(c.env.KV, id);
    if (cached) {
        return cached.changes;
    }

    const insertables = await getInsertables(client, workspace);
    const changes = insertables.changesSinceVersionSave;
    if (changes === undefined) {
        return undefined;
    }

    await changeCounts.put(c.env.KV, id, { changes });
    return changes;
}

/**
 * What a linked workspace is called, and how far it has moved since its last
 * version — cached, because a panel that opens asks about every link at once
 * and the answers change only when somebody edits that document.
 *
 * A transient webhook on the workspace drops both entries when it does. Onshape
 * may drop that webhook quietly, so entries expire as well, and the next miss
 * watches again. Nothing caller-specific is stored: permissions are asked every
 * time, and the names are only ever shown to somebody who has read access.
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
export interface WorkspaceDescription {
    documentName?: string;
    workspaceName?: string;
}

/**
 * A week: a rename is heard about by webhook, so the expiry is only there for
 * a webhook Onshape dropped without telling us.
 */
const DESCRIPTION_TTL_SECONDS = 7 * 24 * 3600;

/**
 * An hour. Shorter than a name's, because an edit is ordinary where a rename is
 * not: a badge that is an hour stale after a missed delivery is still a badge
 * worth showing.
 */
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

/**
 * Starts watching a workspace we have just described, best effort: a webhook we
 * cannot register only means the cache falls back on its expiry.
 */
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

/**
 * Edits the workspace has made since its own last version, or undefined where
 * Onshape did not say. A pull moves onto a version, so these are the edits it
 * would have to cut one to bring in.
 */
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

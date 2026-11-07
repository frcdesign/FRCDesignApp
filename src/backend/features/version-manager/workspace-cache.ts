/**
 * A workspace's names and unversioned changes, a document's default workspace,
 * and each caller's permissions on a document, cached as `units.ts` caches
 * units: a transient webhook drops the entries, and they expire in case Onshape
 * drops the webhook.
 */
import type { AppContext } from "../../lib/context";
import {
    toDefaultWorkspacePath,
    type DocumentPath,
    type InstancePath
} from "../../lib/onshape/path";
import { runInBackground } from "../../lib/background";
import { kvStore } from "../../lib/kv-store";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import {
    getContents,
    getDocument,
    getInsertables
} from "../../lib/onshape/endpoints/documents";
import { getWorkspaces } from "../../lib/onshape/endpoints/workspaces";
import { watchLinkedWorkspace } from "../webhooks/transient";
import {
    toWorkspacePath,
    workspaceKey,
    type ElementMicroversions,
    type WorkspacePath
} from "./contract";

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

/** Each tab's microversion, which moves with every edit to that tab. */
const elementMicroversions = kvStore<ElementMicroversions>(
    "workspace-elements",
    { ttlSeconds: CHANGES_TTL_SECONDS }
);

/** By document id. Onshape never moves a document's default workspace. */
const defaultWorkspaces = kvStore<{ instanceId: string }>("default-workspace", {
    ttlSeconds: DESCRIPTION_TTL_SECONDS
});

/**
 * A day: a sharing change is heard about through the `shared` webhook, and
 * the expiry and the refresh button cover one Onshape drops.
 */
const PERMISSIONS_TTL_SECONDS = 24 * 3600;

/** By `{documentId}:{userId}`, so a document's entries for every caller can be listed and dropped. */
const permissionSets = kvStore<OnshapePermission[]>("document-permissions", {
    ttlSeconds: PERMISSIONS_TTL_SECONDS
});

/**
 * Whether the caller may read the document, for guarding what is cached of it.
 * A stale answer can show a name to somebody who has just lost access, which
 * is accepted; a route that calls Onshape itself leaves the check to Onshape.
 */
export async function canRead(
    c: AppContext,
    client: OnshapeApi,
    document: DocumentPath
): Promise<boolean> {
    const id = `${document.documentId}:${await c.var.getUserId()}`;
    let permissions = await permissionSets.get(c.env.KV, id);
    if (!permissions) {
        permissions = await getPermissions(client, document);
        await permissionSets.put(c.env.KV, id, permissions);
    }
    return permissions.includes(OnshapePermission.READ);
}

/** Every caller's cached permissions on the document. */
export async function forgetPermissions(
    kv: KVNamespace,
    document: DocumentPath
): Promise<void> {
    const ids = await permissionSets.list(kv, `${document.documentId}:`);
    await Promise.all(ids.map((id) => permissionSets.delete(kv, id)));
}

/** A workspace's entries, and its document's permissions, dropped when its webhook says it changed. */
export async function forgetWorkspace(
    kv: KVNamespace,
    workspace: InstancePath
): Promise<void> {
    const id = workspaceKey(workspace);
    await Promise.all([
        descriptions.delete(kv, id),
        changeCounts.delete(kv, id),
        elementMicroversions.delete(kv, id),
        forgetPermissions(kv, workspace)
    ]);
}

/** What a run changed in the workspace, which no webhook reports before the list is read again. */
export async function forgetChanges(
    kv: KVNamespace,
    workspace: InstancePath
): Promise<void> {
    const id = workspaceKey(workspace);
    await Promise.all([
        changeCounts.delete(kv, id),
        elementMicroversions.delete(kv, id)
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

/** Every tab's microversion in the workspace, by element id. */
export async function getElementMicroversions(
    c: AppContext,
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<ElementMicroversions> {
    const id = workspaceKey(workspace);
    const cached = await elementMicroversions.get(c.env.KV, id);
    if (cached) {
        return cached;
    }

    const contents = await getContents(client, workspace);
    const microversions: ElementMicroversions = Object.fromEntries(
        contents.elements.map((element) => [element.id, element.microversionId])
    );
    await elementMicroversions.put(c.env.KV, id, microversions);
    return microversions;
}

/**
 * The workspace a library loads the document's versions from; undefined where
 * Onshape names none. A miss watches it, as naming a linked workspace does.
 */
export async function findDefaultWorkspace(
    c: AppContext,
    client: OnshapeApi,
    document: DocumentPath
): Promise<WorkspacePath | undefined> {
    const cached = await defaultWorkspaces.get(c.env.KV, document.documentId);
    if (cached) {
        return toWorkspacePath(document.documentId, cached.instanceId);
    }

    const found = toDefaultWorkspacePath(await getDocument(client, document));
    if (!found) {
        return undefined;
    }
    const workspace = toWorkspacePath(found.documentId, found.instanceId);
    await defaultWorkspaces.put(c.env.KV, document.documentId, {
        instanceId: workspace.instanceId
    });
    await watch(c, client, workspace);
    return workspace;
}

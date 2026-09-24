/**
 * Transient webhooks, for caches that save Onshape calls. Onshape deletes one
 * after a while without events, so they are registered best effort and never
 * removed or recorded: the url carries its subject, signed so a delivery can be
 * trusted without a lookup.
 */
import type { AppBindings } from "../../lib/context";
import type { OnshapeApi } from "../../lib/onshape/client";
import { createWebhook } from "../../lib/onshape/endpoints/webhooks";
import type { InstancePath } from "../../lib/onshape/path";
import { sign, verify } from "../../lib/signed";

export const UNITS_RECEIVE_PATH = "/api/webhooks/units";

const UPDATE_WORKSPACE_UNITS = "onshape.model.lifecycle.updateworkspaceunits";

function unitsSubject(workspace: InstancePath): string {
    return `${workspace.documentId}:${workspace.instanceId}`;
}

/** Tells the units cache when the workspace's units change. */
export async function watchWorkspaceUnits(
    env: AppBindings,
    onshapeApi: OnshapeApi,
    workspace: InstancePath,
    origin: string
): Promise<void> {
    if (!env.SESSION_SECRET) {
        return;
    }
    const url = new URL(UNITS_RECEIVE_PATH, origin);
    url.searchParams.set("documentId", workspace.documentId);
    url.searchParams.set("workspaceId", workspace.instanceId);
    url.searchParams.set(
        "signature",
        await sign(env.SESSION_SECRET, unitsSubject(workspace))
    );
    await createWebhook(onshapeApi, {
        documentId: workspace.documentId,
        workspaceId: workspace.instanceId,
        events: [UPDATE_WORKSPACE_UNITS],
        url: url.href,
        name: "FRCDesignApp units",
        description: "Keeps the FRCDesignApp's copy of these units current.",
        options: { collapseEvents: true },
        isTransient: true
    });
}

/** The workspace a units delivery names, if its signature is ours. */
export async function readUnitsDelivery(
    env: AppBindings,
    query: Record<string, string | undefined>
): Promise<InstancePath | undefined> {
    const { documentId, workspaceId, signature } = query;
    if (!env.SESSION_SECRET || !documentId || !workspaceId || !signature) {
        return undefined;
    }
    const workspace: InstancePath = {
        documentId,
        instanceId: workspaceId,
        instanceType: "w"
    };
    const valid = await verify(
        env.SESSION_SECRET,
        unitsSubject(workspace),
        signature
    );
    return valid ? workspace : undefined;
}

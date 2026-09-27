/**
 * Transient webhooks, for caches that save Onshape calls. Onshape deletes one
 * after a while without events, so they are registered best effort and never
 * recorded or removed. Onshape doesn't sign what the API registers, and the
 * url carries its subject unsigned: a forged delivery only costs a refetch.
 */
import type { OnshapeApi } from "../../lib/onshape/client";
import { createWebhook } from "../../lib/onshape/endpoints/webhooks";
import type { InstancePath } from "../../lib/onshape/path";

/** Under `/api`. */
export const UNITS_WEBHOOK_ROUTE = "/webhooks/units";

const UPDATE_WORKSPACE_UNITS = "onshape.model.lifecycle.updateworkspaceunits";

/** Tells the units cache when the workspace's units change. */
export async function watchWorkspaceUnits(
    onshapeApi: OnshapeApi,
    workspace: InstancePath,
    origin: string
): Promise<void> {
    const url = new URL("/api" + UNITS_WEBHOOK_ROUTE, origin);
    url.searchParams.set("documentId", workspace.documentId);
    url.searchParams.set("workspaceId", workspace.instanceId);
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

/** The workspace a units delivery names. */
export function readUnitsDelivery(
    query: Record<string, string | undefined>
): InstancePath | undefined {
    const { documentId, workspaceId } = query;
    if (!documentId || !workspaceId) {
        return undefined;
    }
    return { documentId, instanceId: workspaceId, instanceType: "w" };
}

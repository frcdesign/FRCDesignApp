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

/** The same, for a workspace the version manager links to. */
export const LINKED_WORKSPACE_WEBHOOK_ROUTE = "/webhooks/linked-workspace";

const UPDATE_WORKSPACE_UNITS = "onshape.model.lifecycle.updateworkspaceunits";

/**
 * What can change what the version manager shows of a linked workspace: its
 * name and its document's (`metadata`), how far it has moved since its last
 * version (`changed`, and `createversion`, which resets the count).
 */
const LINKED_WORKSPACE_EVENTS = [
    "onshape.model.lifecycle.changed",
    "onshape.model.lifecycle.metadata",
    "onshape.model.lifecycle.createversion"
];

interface TransientWebhook {
    route: string;
    events: string[];
    /** What the webhook is called, and what keeping it is for, in Onshape. */
    name: string;
    description: string;
}

/** Registers one on `workspace`, delivered to `route` with the workspace in the url. */
async function watchWorkspace(
    onshapeApi: OnshapeApi,
    workspace: InstancePath,
    appUrl: string,
    webhook: TransientWebhook
): Promise<void> {
    await createWebhook(onshapeApi, {
        documentId: workspace.documentId,
        workspaceId: workspace.instanceId,
        events: webhook.events,
        url: toWorkspaceUrl(webhook.route, workspace, appUrl),
        name: webhook.name,
        description: webhook.description,
        options: { collapseEvents: true },
        isTransient: true
    });
}

/** Tells the units cache when the workspace's units change. */
export function watchWorkspaceUnits(
    onshapeApi: OnshapeApi,
    workspace: InstancePath,
    appUrl: string
): Promise<void> {
    return watchWorkspace(onshapeApi, workspace, appUrl, {
        route: UNITS_WEBHOOK_ROUTE,
        events: [UPDATE_WORKSPACE_UNITS],
        name: "FRCDesignApp units",
        description: "Keeps the FRCDesignApp's copy of these units current."
    });
}

/** Tells the version manager's caches when a linked workspace changes. */
export function watchLinkedWorkspace(
    onshapeApi: OnshapeApi,
    workspace: InstancePath,
    appUrl: string
): Promise<void> {
    return watchWorkspace(onshapeApi, workspace, appUrl, {
        route: LINKED_WORKSPACE_WEBHOOK_ROUTE,
        events: LINKED_WORKSPACE_EVENTS,
        name: "FRCDesignApp version manager",
        description:
            "Keeps the FRCDesignApp's copy of this workspace's name and pending changes current."
    });
}

/** Where a delivery about `workspace` is sent, carrying it in the url. */
function toWorkspaceUrl(
    route: string,
    workspace: InstancePath,
    appUrl: string
): string {
    const url = new URL("/api" + route, appUrl);
    url.searchParams.set("documentId", workspace.documentId);
    url.searchParams.set("workspaceId", workspace.instanceId);
    return url.href;
}

/** The workspace a delivery names, for either of the routes above. */
export function readWorkspaceDelivery(
    query: Record<string, string | undefined>
): InstancePath | undefined {
    const { documentId, workspaceId } = query;
    if (!documentId || !workspaceId) {
        return undefined;
    }
    return { documentId, instanceId: workspaceId, instanceType: "w" };
}

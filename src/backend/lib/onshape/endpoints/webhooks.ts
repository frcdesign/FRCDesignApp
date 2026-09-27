import { OnshapeApi } from "../client";

export interface OnshapeWebhookInfo {
    id: string;
    url: string;
    events: string[];
}

export interface CreateWebhookParams {
    /** The company whose events it hears; the caller has to administer it. */
    companyId?: string;
    /** The document whose events it hears, for a document's events. */
    documentId?: string;
    /** Narrows a document's events to one workspace's. */
    workspaceId?: string;
    events: string[];
    url: string;
    name: string;
    description: string;
    options: { collapseEvents: boolean };
    /** False, or Onshape deletes it after a while without events. */
    isTransient: boolean;
}

export function getWebhook(
    client: OnshapeApi,
    webhookId: string
): Promise<OnshapeWebhookInfo> {
    return client.get(`/webhooks/${encodeURIComponent(webhookId)}`);
}

export function createWebhook(
    client: OnshapeApi,
    params: CreateWebhookParams
): Promise<OnshapeWebhookInfo> {
    return client.post("/webhooks", { body: params });
}

/** Onshape delivers a `webhook.ping` to the webhook's url. */
export function pingWebhook(
    client: OnshapeApi,
    webhookId: string
): Promise<void> {
    return client.postNone(`/webhooks/${encodeURIComponent(webhookId)}/ping`);
}

export function deleteWebhook(
    client: OnshapeApi,
    webhookId: string
): Promise<void> {
    return client.deleteNone(`/webhooks/${encodeURIComponent(webhookId)}`);
}

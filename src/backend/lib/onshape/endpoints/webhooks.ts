import { OnshapeApi } from "../client";

export interface OnshapeWebhookInfo {
    id: string;
    url: string;
    events: string[];
}

export interface CreateWebhookParams {
    /** The company whose events it hears; the caller has to administer it. */
    companyId: string;
    events: string[];
    url: string;
    name: string;
    description: string;
    options: { collapseEvents: boolean };
    /** False, or Onshape deletes it after a while without events. */
    isTransient: boolean;
}

export async function getCompanyWebhooks(
    client: OnshapeApi,
    companyId: string
): Promise<OnshapeWebhookInfo[]> {
    const response: { items: OnshapeWebhookInfo[] } = await client.get(
        "/webhooks",
        { query: { company: companyId } }
    );
    return response.items;
}

export function createWebhook(
    client: OnshapeApi,
    params: CreateWebhookParams
): Promise<OnshapeWebhookInfo> {
    return client.post("/webhooks", { body: params });
}

export function deleteWebhook(
    client: OnshapeApi,
    webhookId: string
): Promise<void> {
    return client.deleteNone(`/webhooks/${encodeURIComponent(webhookId)}`);
}

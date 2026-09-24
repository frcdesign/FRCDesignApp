/**
 * Keeps this deployment's Onshape webhook registered, on the owner's behalf:
 * Onshape creates webhooks with a user's token, and events for the whole
 * company want one of its admins, which the owner is taken to be. Checked
 * whenever the owner's access is resolved, so it needs no one to set it up and
 * comes back by itself if Onshape drops it.
 */
import type { AppBindings } from "../../lib/context";
import { type OAuthApi, OnshapeApiError } from "../../lib/onshape/client";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import {
    createWebhook,
    deleteWebhook,
    getCompanyWebhooks,
    getWebhook
} from "../../lib/onshape/endpoints/webhooks";

export const RECEIVE_PATH = "/api/webhooks/onshape";

export enum WebhookEvent {
    CREATE_VERSION = "onshape.model.lifecycle.createversion",
    TEAM_ADD_MEMBER = "onshape.team.addmember",
    TEAM_REMOVE_MEMBER = "onshape.team.removemember"
}

/** What was registered, and the token its deliveries carry. */
export interface WebhookRegistration {
    token: string;
    /** Absent between storing the token and Onshape answering the create. */
    webhookId?: string;
}

const REGISTRATION_KEY = "webhook-registration";

export async function getRegistration(
    env: AppBindings
): Promise<WebhookRegistration | null> {
    return env.KV.get<WebhookRegistration>(REGISTRATION_KEY, "json");
}

/** For when Onshape says it dropped the webhook: the next check registers anew. */
export async function forgetRegistration(env: AppBindings): Promise<void> {
    await env.KV.delete(REGISTRATION_KEY);
}

/** Whether the recorded webhook is still Onshape's, at this deployment's url. */
async function isStillRegistered(
    onshapeApi: OAuthApi,
    registration: WebhookRegistration | null,
    receiveUrl: URL
): Promise<boolean> {
    if (!registration?.webhookId) {
        return false;
    }
    try {
        const webhook = await getWebhook(onshapeApi, registration.webhookId);
        return webhook.url.startsWith(receiveUrl.href);
    } catch (error) {
        if (error instanceof OnshapeApiError && error.status === 404) {
            return false;
        }
        throw error;
    }
}

/**
 * Registers the webhook unless the one on record still stands. `origin` is
 * this deployment's, which the webhook is delivered to.
 */
export async function ensureWebhook(
    env: AppBindings,
    onshapeApi: OAuthApi,
    origin: string
): Promise<void> {
    const receiveUrl = new URL(RECEIVE_PATH, origin);
    if (
        await isStillRegistered(
            onshapeApi,
            await getRegistration(env),
            receiveUrl
        )
    ) {
        return;
    }

    const companyId = (await getSessionInfo(onshapeApi)).company?.id;
    if (!companyId) {
        console.warn(
            "Not registering Onshape webhooks: the owner opened the app outside their company."
        );
        return;
    }

    // Matched on this deployment's url alone, so dev, cert and production
    // registering under one company leave each other's in place.
    for (const webhook of await getCompanyWebhooks(onshapeApi, companyId)) {
        if (webhook.url.startsWith(receiveUrl.href)) {
            await deleteWebhook(onshapeApi, webhook.id);
        }
    }

    // Stored first: Onshape posts webhook.register before create returns.
    const token = crypto.randomUUID();
    await env.KV.put(REGISTRATION_KEY, JSON.stringify({ token }));
    receiveUrl.searchParams.set("token", token);

    const webhook = await createWebhook(onshapeApi, {
        companyId,
        events: Object.values(WebhookEvent),
        url: receiveUrl.href,
        name: "FRCDesignApp",
        description:
            "Reloads library documents on a new version, and access on admin team changes.",
        options: { collapseEvents: false },
        isTransient: false
    });
    await env.KV.put(
        REGISTRATION_KEY,
        JSON.stringify({ token, webhookId: webhook.id })
    );
}

/**
 * One per library document, for its new versions, registered with
 * `isTransient: false`, which exempts it from Onshape's cleanup.
 */
import { and, eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { onshapeWebhooks, WebhookSubject } from "../../db/schema";
import { type OAuthApi, OnshapeApiError } from "../../lib/onshape/client";
import {
    createWebhook,
    deleteWebhook,
    getWebhook,
    pingWebhook
} from "../../lib/onshape/endpoints/webhooks";

/** Under `/api`. */
export const WEBHOOK_ROUTE = "/webhooks/onshape";

export enum WebhookEvent {
    CREATE_VERSION = "onshape.model.lifecycle.createversion",
    UNREGISTER = "webhook.unregister"
}

export type RegisteredWebhook = typeof onshapeWebhooks.$inferSelect;

function whereSubject(subject: WebhookSubject, subjectId: string) {
    return and(
        eq(onshapeWebhooks.subject, subject),
        eq(onshapeWebhooks.subjectId, subjectId)
    );
}

function subjectParams(subject: WebhookSubject, subjectId: string) {
    switch (subject) {
        case WebhookSubject.DOCUMENT:
            return {
                documentId: subjectId,
                events: [WebhookEvent.CREATE_VERSION]
            };
    }
}

/**
 * Whether Onshape still has it. A webhook it cancelled (a failed registration
 * ping) or deactivated (deliveries that errored) sends us nothing to say so.
 */
async function isStillRegistered(
    onshapeApi: OAuthApi,
    webhookId: string
): Promise<boolean> {
    try {
        await getWebhook(onshapeApi, webhookId);
        return true;
    } catch (error) {
        if (error instanceof OnshapeApiError && error.status === 404) {
            return false;
        }
        throw error;
    }
}

/** Onshape can't deliver to this machine, so it cancels such a webhook at once. */
export function isLocalOrigin(origin: string): boolean {
    const { hostname } = new URL(origin);
    return (
        hostname === "localhost" ||
        hostname === "[::1]" ||
        hostname.startsWith("127.")
    );
}

/** Registers a webhook for the subject unless Onshape still has the one on record. */
export async function ensureWebhook(
    env: AppBindings,
    onshapeApi: OAuthApi,
    subject: WebhookSubject,
    subjectId: string,
    origin: string
): Promise<void> {
    if (isLocalOrigin(origin)) {
        console.warn("Not registering a webhook Onshape can't reach", {
            subject,
            subjectId,
            origin
        });
        return;
    }
    const db = getDb(env.DB);
    const existing = await db
        .select({ webhookId: onshapeWebhooks.webhookId })
        .from(onshapeWebhooks)
        .where(whereSubject(subject, subjectId))
        .get();
    if (
        existing?.webhookId &&
        (await isStillRegistered(onshapeApi, existing.webhookId))
    ) {
        return;
    }
    if (existing?.webhookId) {
        console.warn("Webhook gone from Onshape; registering again", {
            subject,
            subjectId,
            webhookId: existing.webhookId
        });
    }

    // Stored first: Onshape posts webhook.register before create returns.
    const token = crypto.randomUUID();
    await db
        .insert(onshapeWebhooks)
        .values({ subject, subjectId, token })
        .onConflictDoUpdate({
            target: [onshapeWebhooks.subject, onshapeWebhooks.subjectId],
            set: { token, webhookId: null }
        });
    const url = new URL("/api" + WEBHOOK_ROUTE, origin);
    // Logged before the token goes on, since the token is the webhook's password.
    const logged = { subject, subjectId, url: url.href };
    url.searchParams.set("token", token);

    const webhook = await createWebhook(onshapeApi, {
        ...subjectParams(subject, subjectId),
        url: url.href,
        name: "FRCDesignApp",
        description: `Keeps the FRCDesignApp in step with this ${subject}.`,
        options: { collapseEvents: false },
        isTransient: false
    });
    await db
        .update(onshapeWebhooks)
        .set({ webhookId: webhook.id })
        .where(whereSubject(subject, subjectId));
    console.log("Registered webhook", { ...logged, webhookId: webhook.id });

    // Arrives as a `webhook.ping` delivery; its absence from the logs means
    // Onshape can't reach the url.
    try {
        await pingWebhook(onshapeApi, webhook.id);
    } catch (error) {
        console.error("Webhook ping failed", {
            ...logged,
            webhookId: webhook.id,
            error
        });
    }
}

/** Unregisters the subject's webhook, when nothing needs it any more. */
export async function removeWebhook(
    env: AppBindings,
    onshapeApi: OAuthApi,
    subject: WebhookSubject,
    subjectId: string
): Promise<void> {
    const db = getDb(env.DB);
    const existing = await db
        .select({ webhookId: onshapeWebhooks.webhookId })
        .from(onshapeWebhooks)
        .where(whereSubject(subject, subjectId))
        .get();
    if (existing?.webhookId) {
        try {
            await deleteWebhook(onshapeApi, existing.webhookId);
        } catch (error) {
            // Already gone is what was wanted.
            if (!(error instanceof OnshapeApiError && error.status === 404)) {
                throw error;
            }
        }
    }
    await db.delete(onshapeWebhooks).where(whereSubject(subject, subjectId));
}

/** The webhook a delivery's token belongs to, or undefined for a stranger. */
export function findWebhookByToken(
    env: AppBindings,
    token: string
): Promise<RegisteredWebhook | undefined> {
    return getDb(env.DB)
        .select()
        .from(onshapeWebhooks)
        .where(eq(onshapeWebhooks.token, token))
        .get();
}

/** So the next load registers another. */
export async function forgetWebhook(
    env: AppBindings,
    webhook: RegisteredWebhook
): Promise<void> {
    await getDb(env.DB)
        .delete(onshapeWebhooks)
        .where(whereSubject(webhook.subject, webhook.subjectId));
}

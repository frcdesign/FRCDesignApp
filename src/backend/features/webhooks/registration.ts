/**
 * One per library document, for new versions, and one per admin team. Each is
 * registered with `isTransient: false`, which exempts it from Onshape's cleanup.
 */
import { and, eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { onshapeWebhooks, WebhookSubject } from "../../db/schema";
import { type OAuthApi, OnshapeApiError } from "../../lib/onshape/client";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import {
    createWebhook,
    deleteWebhook
} from "../../lib/onshape/endpoints/webhooks";

export const RECEIVE_PATH = "/api/webhooks/onshape";

export enum WebhookEvent {
    CREATE_VERSION = "onshape.model.lifecycle.createversion",
    TEAM_ADD_MEMBER = "onshape.team.addmember",
    TEAM_REMOVE_MEMBER = "onshape.team.removemember",
    UNREGISTER = "webhook.unregister"
}

export type RegisteredWebhook = typeof onshapeWebhooks.$inferSelect;

function whereSubject(subject: WebhookSubject, subjectId: string) {
    return and(
        eq(onshapeWebhooks.subject, subject),
        eq(onshapeWebhooks.subjectId, subjectId)
    );
}

/** Team events are company-wide, so a team's webhook names the company and the receiver filters. */
async function subjectParams(
    onshapeApi: OAuthApi,
    subject: WebhookSubject,
    subjectId: string
) {
    if (subject === WebhookSubject.DOCUMENT) {
        return {
            documentId: subjectId,
            events: [WebhookEvent.CREATE_VERSION]
        };
    }
    const companyId = (await getSessionInfo(onshapeApi)).company?.id;
    if (!companyId) {
        throw new Error(
            "A team's webhook needs a company; open the app from your company's Onshape."
        );
    }
    return {
        companyId,
        events: [WebhookEvent.TEAM_ADD_MEMBER, WebhookEvent.TEAM_REMOVE_MEMBER]
    };
}

/** Registers a webhook for the subject unless one is already on record. */
export async function ensureWebhook(
    env: AppBindings,
    onshapeApi: OAuthApi,
    subject: WebhookSubject,
    subjectId: string,
    origin: string
): Promise<void> {
    const db = getDb(env.DB);
    const existing = await db
        .select({ webhookId: onshapeWebhooks.webhookId })
        .from(onshapeWebhooks)
        .where(whereSubject(subject, subjectId))
        .get();
    if (existing?.webhookId) {
        return;
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
    const url = new URL(RECEIVE_PATH, origin);
    url.searchParams.set("token", token);

    const webhook = await createWebhook(onshapeApi, {
        ...(await subjectParams(onshapeApi, subject, subjectId)),
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

/** So the next load or team change registers another. */
export async function forgetWebhook(
    env: AppBindings,
    webhook: RegisteredWebhook
): Promise<void> {
    await getDb(env.DB)
        .delete(onshapeWebhooks)
        .where(whereSubject(webhook.subject, webhook.subjectId));
}

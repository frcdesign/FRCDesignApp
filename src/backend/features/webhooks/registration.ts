/**
 * The Onshape webhooks this deployment registers: one per library document,
 * for its new versions, and one per admin team, for its members. Each is
 * registered with `isTransient: false`, which Onshape documents as exempting
 * it from cleanup, so once one is on record it is taken to stand.
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

/**
 * What to ask Onshape for. A document's names the document, from which Onshape
 * infers the company. A team's events are company-wide and name no team, so
 * the company is the registering user's, and the receiver picks out the team.
 */
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

    // Stored first: Onshape posts webhook.register to the url before create
    // returns, and the token is how the receiver recognizes it.
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

/**
 * Drops the record of a webhook Onshape unregistered, so the next load of its
 * document, or setting of its team, registers another.
 */
export async function forgetWebhook(
    env: AppBindings,
    webhook: RegisteredWebhook
): Promise<void> {
    await getDb(env.DB)
        .delete(onshapeWebhooks)
        .where(whereSubject(webhook.subject, webhook.subjectId));
}

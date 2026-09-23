/**
 * Onshape's webhooks: registered by the owner for their company, and received
 * here. A new version of a library document reloads its groups, and a change
 * to the admin team's members re-asks everyone's access level.
 *
 * A notification carries nothing trusted: it only names a document or team,
 * and what follows re-reads Onshape. The url's token is what keeps anyone
 * else from making the server do that work.
 */
import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { type AppBindings, getApp } from "../../lib/context";
import { forbiddenError, handledError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { getSessionInfo } from "../../lib/onshape/endpoints/users";
import {
    createWebhook,
    deleteWebhook,
    getCompanyWebhooks
} from "../../lib/onshape/endpoints/webhooks";
import { requireOwnerMiddleware } from "../auth/guards";
import { clearAccessLevels } from "../auth/session";
import { queueReload } from "../load/reload";
import { pushAccessChanged } from "../live/notify";

export const webhookRoutes = getApp();

const RECEIVE_PATH = "/api/webhooks/onshape";

/** Kept in KV rather than configured, so registering is all it takes. */
const TOKEN_KEY = "webhook-token";

export enum WebhookEvent {
    CREATE_VERSION = "onshape.model.lifecycle.createversion",
    TEAM_ADD_MEMBER = "onshape.team.addmember",
    TEAM_REMOVE_MEMBER = "onshape.team.removemember"
}

/** The fields read off a notification; Onshape sends more. */
interface WebhookNotification {
    event: string;
    documentId?: string;
    teamId?: string;
}

/** POST /api/webhooks/register — replaces this deployment's webhook. */
webhookRoutes.post("/webhooks/register", requireOwnerMiddleware, async (c) => {
    const onshapeApi = await c.var.getOnshapeApi();
    const companyId = (await getSessionInfo(onshapeApi)).company?.id;
    if (!companyId) {
        throw handledError(
            "Open the app from your company's Onshape to register its webhooks.",
            HttpStatus.BAD_REQUEST
        );
    }

    // Matched on this deployment's url alone, so dev, cert and production
    // registering under one company leave each other's in place.
    const receiveUrl = new URL(RECEIVE_PATH, c.req.url);
    const existing = await getCompanyWebhooks(onshapeApi, companyId);
    for (const webhook of existing) {
        if (webhook.url.startsWith(receiveUrl.href)) {
            await deleteWebhook(onshapeApi, webhook.id);
        }
    }

    // Stored first: Onshape posts webhook.register before create returns.
    const token = crypto.randomUUID();
    await c.env.KV.put(TOKEN_KEY, token);
    receiveUrl.searchParams.set("token", token);

    await createWebhook(onshapeApi, {
        companyId,
        events: Object.values(WebhookEvent),
        url: receiveUrl.href,
        name: "FRCDesignApp",
        description:
            "Reloads library documents on a new version, and access on admin team changes.",
        options: { collapseEvents: false },
        isTransient: false
    });
    return c.json({ status: "registered" });
});

/** POST /api/webhooks/onshape?token= — where Onshape delivers. */
webhookRoutes.post("/webhooks/onshape", async (c) => {
    const token = c.req.query("token");
    const expected = await c.env.KV.get(TOKEN_KEY);
    if (!token || !expected || !tokensMatch(token, expected)) {
        throw forbiddenError("Unrecognized webhook");
    }

    const notification = await c.req.json<WebhookNotification>();
    switch (notification.event) {
        case WebhookEvent.CREATE_VERSION:
            if (notification.documentId) {
                await reloadDocument(c.env, notification.documentId);
            }
            break;
        case WebhookEvent.TEAM_ADD_MEMBER:
        case WebhookEvent.TEAM_REMOVE_MEMBER:
            if (notification.teamId === c.env.ADMIN_TEAM) {
                await clearAccessLevels(c.env.KV);
                await pushAccessChanged(c.env);
            }
            break;
        // webhook.register and webhook.ping only want a 200, which registration
        // fails without.
    }
    return c.json({});
});

/** Reloads the document's groups in every library holding it; most hold none. */
async function reloadDocument(
    env: AppBindings,
    documentId: string
): Promise<void> {
    const libraries = await getDb(env.DB)
        .selectDistinct({ libraryId: groups.libraryId })
        .from(groups)
        .where(eq(groups.documentId, documentId));
    for (const { libraryId } of libraries) {
        await queueReload(env, libraryId, [documentId]);
    }
}

/** Compared in constant time, so response timing gives nothing of it away. */
function tokensMatch(given: string, expected: string): boolean {
    if (given.length !== expected.length) {
        return false;
    }
    let difference = 0;
    for (let i = 0; i < given.length; i++) {
        difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return difference === 0;
}

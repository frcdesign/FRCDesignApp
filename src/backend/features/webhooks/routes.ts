/**
 * Onshape's webhooks, as delivered; `registration.ts` keeps them registered. A new version of a library document reloads its groups, and a change
 * to the admin team's members re-asks everyone's access level.
 *
 * A notification carries nothing trusted: it only names a document or team,
 * and what follows re-reads Onshape. The url's token is what keeps anyone
 * else from making the server do that work.
 */
import { eq } from "drizzle-orm";
import { type AppBindings, getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { clearAccessLevels } from "../auth/session";
import { queueReload } from "../load/reload";
import { pushAccessChanged } from "../live/notify";
import {
    forgetRegistration,
    getRegistration,
    WebhookEvent
} from "./registration";

export const webhookRoutes = getApp();

/** The fields read off a notification; Onshape sends more. */
interface WebhookNotification {
    event: string;
    webhookId?: string;
    documentId?: string;
    teamId?: string;
}

/** POST /api/webhooks/onshape?token= — where Onshape delivers. */
webhookRoutes.post("/webhooks/onshape", async (c) => {
    const token = c.req.query("token");
    const expected = (await getRegistration(c.env))?.token;
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
        case "webhook.unregister":
            if (
                notification.webhookId ===
                (await getRegistration(c.env))?.webhookId
            ) {
                await forgetRegistration(c.env);
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

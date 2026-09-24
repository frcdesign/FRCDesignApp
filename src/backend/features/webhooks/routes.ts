/**
 * Acts on the subject the url's token was registered for, never on what the
 * payload names: the token is all that keeps others from triggering this.
 */
import { eq } from "drizzle-orm";
import { type AppBindings, getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups, WebhookSubject } from "../../db/schema";
import { requestLoads } from "../load/jobs";
import {
    findWebhookByToken,
    forgetWebhook,
    RECEIVE_PATH,
    WebhookEvent
} from "./registration";
import { readUnitsDelivery, UNITS_RECEIVE_PATH } from "./transient";
import { forgetUnitInfo } from "../configurations/units";

export const webhookRoutes = getApp();

/** The fields read off a notification; Onshape sends more. */
interface WebhookNotification {
    event: string;
}

/** POST /api/webhooks/onshape?token= */
webhookRoutes.post(RECEIVE_PATH.replace(/^\/api/, ""), async (c) => {
    const token = c.req.query("token");
    const webhook = token ? await findWebhookByToken(c.env, token) : undefined;
    if (!webhook) {
        throw forbiddenError("Unrecognized webhook");
    }

    const notification = await c.req.json<WebhookNotification>();
    switch (notification.event) {
        case WebhookEvent.CREATE_VERSION:
            if (webhook.subject === WebhookSubject.DOCUMENT) {
                await reloadDocument(
                    c.env,
                    webhook.subjectId,
                    new URL(c.req.url).origin
                );
            }
            break;
        case WebhookEvent.UNREGISTER:
            await forgetWebhook(c.env, webhook);
            break;
        // Registration fails without a 200.
    }
    return c.json({});
});

/** POST /api/webhooks/units?documentId=&workspaceId=&signature= */
webhookRoutes.post(UNITS_RECEIVE_PATH.replace(/^\/api/, ""), async (c) => {
    const workspace = await readUnitsDelivery(c.env, c.req.query());
    if (!workspace) {
        throw forbiddenError("Unrecognized webhook");
    }
    // Registration and pings only want a 200; any other event is the change.
    const { event } = await c.req.json<WebhookNotification>();
    if (!event.startsWith("webhook.")) {
        await forgetUnitInfo(c.env.KV, workspace);
    }
    return c.json({});
});

/** Nobody is signed in behind a webhook, so each load finds an admin's session. */
async function reloadDocument(
    env: AppBindings,
    documentId: string,
    origin: string
): Promise<void> {
    const documentGroups = await getDb(env.DB)
        .select({ groupId: groups.id, libraryId: groups.libraryId })
        .from(groups)
        .where(eq(groups.documentId, documentId));
    await requestLoads(
        env,
        documentGroups.map((group) => ({
            ...group,
            forceReload: false,
            origin
        }))
    );
}

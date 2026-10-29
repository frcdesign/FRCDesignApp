/**
 * Acts on the subject the url's token was registered for, never on what the
 * payload names: the token is all that keeps others from triggering this.
 */
import { type AppContext, getApp } from "../../lib/context";
import type { InstancePath } from "../../lib/onshape/path";
import { forbiddenError } from "../../lib/api-error";
import { WebhookSubject } from "../../db/schema";
import { holdNewVersion } from "../load/holds";
import {
    findWebhookByToken,
    forgetWebhook,
    WEBHOOK_ROUTE,
    WebhookEvent
} from "./registration";
import { runInBackground } from "../../lib/background";
import {
    LINKED_WORKSPACE_WEBHOOK_ROUTE,
    readWorkspaceDelivery,
    UNITS_WEBHOOK_ROUTE
} from "./transient";
import { forgetUnitInfo } from "../configurations/units";
import { forgetWorkspace } from "../version-manager/workspace-cache";

export const webhookRoutes = getApp();

/** The fields read off a notification; Onshape sends more. */
interface WebhookNotification {
    event: string;
}

/**
 * POST /api/webhooks/onshape?token=. Answers 200 at once and does the work
 * after: Onshape deactivates a webhook whose deliveries error or stall.
 */
webhookRoutes.post(WEBHOOK_ROUTE, async (c) => {
    const { event } = await c.req.json<WebhookNotification>();
    const token = c.req.query("token");
    const webhook = token ? await findWebhookByToken(c.env, token) : undefined;
    if (!webhook) {
        console.warn("Webhook delivery with an unknown token", { event });
        throw forbiddenError("Unrecognized webhook");
    }
    const { subject, subjectId } = webhook;

    await runInBackground(c, `handle ${event} for ${subjectId}`, async () => {
        switch (event) {
            case WebhookEvent.CREATE_VERSION:
                if (subject === WebhookSubject.DOCUMENT) {
                    await holdNewVersion(c.env, subjectId);
                }
                break;
            case WebhookEvent.UNREGISTER:
                await forgetWebhook(c.env, webhook);
                break;
            // Anything else, webhook.register included, only wants the 200.
        }
    });
    return c.json({});
});

/**
 * A transient webhook's delivery: a change to the workspace it watches, which
 * drops what is cached of it. Registration and pings only want a 200.
 */
function forgetOnChange(
    forget: (kv: KVNamespace, workspace: InstancePath) => Promise<void>
) {
    return async (c: AppContext) => {
        const workspace = readWorkspaceDelivery(c.req.query());
        if (!workspace) {
            throw forbiddenError("Unrecognized webhook");
        }
        const { event } = await c.req.json<WebhookNotification>();
        if (!event.startsWith("webhook.")) {
            await forget(c.env.KV, workspace);
        }
        return c.json({});
    };
}

/** POST /api/webhooks/units?documentId=&workspaceId= */
webhookRoutes.post(UNITS_WEBHOOK_ROUTE, forgetOnChange(forgetUnitInfo));

/** POST /api/webhooks/linked-workspace?documentId=&workspaceId= */
webhookRoutes.post(
    LINKED_WORKSPACE_WEBHOOK_ROUTE,
    forgetOnChange(forgetWorkspace)
);

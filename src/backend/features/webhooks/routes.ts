/**
 * Acts on the subject the url's token was registered for, never on what the
 * payload names: the token is all that keeps others from triggering this.
 */
import { eq } from "drizzle-orm";
import { type AppBindings, getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups, libraries, WebhookSubject } from "../../db/schema";
import { requestLoads } from "../load/jobs";
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
import { toWorkspacePath } from "../version-manager/contract";

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
                    await reloadDocument(c.env, subjectId);
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

/** POST /api/webhooks/units?documentId=&workspaceId= */
webhookRoutes.post(UNITS_WEBHOOK_ROUTE, async (c) => {
    const workspace = readWorkspaceDelivery(c.req.query());
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

/**
 * POST /api/webhooks/linked-workspace?documentId=&workspaceId=
 *
 * The workspace was edited, renamed or versioned, so what the version manager
 * shows of it is asked for again the next time somebody opens the panel.
 */
webhookRoutes.post(LINKED_WORKSPACE_WEBHOOK_ROUTE, async (c) => {
    const workspace = readWorkspaceDelivery(c.req.query());
    if (!workspace) {
        throw forbiddenError("Unrecognized webhook");
    }
    const { event } = await c.req.json<WebhookNotification>();
    if (!event.startsWith("webhook.")) {
        await forgetWorkspace(
            c.env,
            toWorkspacePath(workspace.documentId, workspace.instanceId)
        );
    }
    return c.json({});
});

/**
 * Nobody is signed in behind a webhook, so each load finds an admin's session.
 * A library that approves versions holds the load until an admin does.
 */
async function reloadDocument(
    env: AppBindings,
    documentId: string
): Promise<void> {
    const documentGroups = await getDb(env.DB)
        .select({
            groupId: groups.id,
            libraryId: groups.libraryId,
            awaitApproval: libraries.approveVersions
        })
        .from(groups)
        .innerJoin(libraries, eq(libraries.id, groups.libraryId))
        .where(eq(groups.documentId, documentId));
    await requestLoads(
        env,
        documentGroups.map((group) => ({
            ...group,
            forceReload: false
        }))
    );
}

/**
 * Where Onshape delivers; `registration.ts` registers what it delivers for.
 * A new version of a library document reloads its groups, and a change to an
 * admin team's members pulls that team again.
 *
 * A delivery is recognized by the token in its url, and acted on for the
 * subject that token was registered for, never for what the payload names: the
 * url is all that keeps anyone else from making the server do this work.
 */
import { eq } from "drizzle-orm";
import { type AppBindings, getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups, WebhookSubject } from "../../db/schema";
import { getOwnerOnshapeApi, getOwnerSessionId } from "../auth/owner";
import { librariesOfTeam, syncAdminTeam } from "../admin-team/sync";
import { requestLoads } from "../load/jobs";
import {
    findWebhookByToken,
    forgetWebhook,
    RECEIVE_PATH,
    WebhookEvent
} from "./registration";

export const webhookRoutes = getApp();

/** The fields read off a notification; Onshape sends more. */
interface WebhookNotification {
    event: string;
    teamId?: string;
}

/** POST /api/webhooks/onshape?token= */
webhookRoutes.post(RECEIVE_PATH.replace(/^\/api/, ""), async (c) => {
    const token = c.req.query("token");
    const webhook = token ? await findWebhookByToken(c.env, token) : undefined;
    if (!webhook) {
        throw forbiddenError("Unrecognized webhook");
    }

    const notification = await c.req.json<WebhookNotification>();
    const origin = new URL(c.req.url).origin;
    switch (notification.event) {
        case WebhookEvent.CREATE_VERSION:
            if (webhook.subject === WebhookSubject.DOCUMENT) {
                await reloadDocument(c.env, webhook.subjectId, origin);
            }
            break;
        case WebhookEvent.TEAM_ADD_MEMBER:
        case WebhookEvent.TEAM_REMOVE_MEMBER:
            // A team's webhook hears every team in the company.
            if (
                webhook.subject === WebhookSubject.TEAM &&
                notification.teamId === webhook.subjectId
            ) {
                await resyncTeam(c.env, webhook.subjectId);
            }
            break;
        case WebhookEvent.UNREGISTER:
            await forgetWebhook(c.env, webhook);
            break;
        // webhook.register and webhook.ping only want a 200, which registration
        // fails without.
    }
    return c.json({});
});

/**
 * Loads the document's groups, in every library holding it, under the owner's
 * session: nobody is signed in behind a webhook.
 */
async function reloadDocument(
    env: AppBindings,
    documentId: string,
    origin: string
): Promise<void> {
    const sessionId = await getOwnerSessionId(env.KV);
    if (!sessionId) {
        console.warn(
            `No owner session to reload ${documentId} with; the owner has not used the app yet.`
        );
        return;
    }
    const documentGroups = await getDb(env.DB)
        .select({ groupId: groups.id, libraryId: groups.libraryId })
        .from(groups)
        .where(eq(groups.documentId, documentId));
    await requestLoads(
        env,
        documentGroups.map((group) => ({
            ...group,
            sessionId,
            forceReload: false,
            origin
        }))
    );
}

/** Pulls the team's members again for every library it administers. */
async function resyncTeam(env: AppBindings, teamId: string): Promise<void> {
    const onshapeApi = await getOwnerOnshapeApi(env.KV);
    if (!onshapeApi) {
        console.warn(
            `No owner session to pull team ${teamId} with; the owner has not used the app yet.`
        );
        return;
    }
    for (const libraryId of await librariesOfTeam(env, teamId)) {
        await syncAdminTeam(env, onshapeApi, libraryId);
    }
}

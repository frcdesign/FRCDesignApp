/**
 * Acts on the subject the url's token was registered for, never on what the
 * payload names: the token is all that keeps others from triggering this.
 */
import { eq, inArray } from "drizzle-orm";
import { type AppBindings, getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { adminTeamMembers, groups, WebhookSubject } from "../../db/schema";
import {
    getLiveSession,
    getOwnerSession,
    type UserSession
} from "../auth/user-sessions";
import { getVersion } from "../../lib/onshape/endpoints/versions";
import { flagGroups, publishLibraries } from "../load/flag";
import { BuildIssueType } from "../build-checker/issues";
import { librariesOfTeam, syncAdminTeam } from "../admin-team/sync";
import { requestLoads } from "../load/jobs";
import type { LibraryId } from "../library/library-id";
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
    versionId?: string;
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
                await reloadDocument(
                    c.env,
                    webhook.subjectId,
                    notification.versionId,
                    origin
                );
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
        // Registration fails without a 200.
    }
    return c.json({});
});

/**
 * Loads the document's groups as whoever made the version, if their session
 * still works, else as the owner. Without either, the groups are flagged for
 * an admin to reload.
 */
async function reloadDocument(
    env: AppBindings,
    documentId: string,
    versionId: string | undefined,
    origin: string
): Promise<void> {
    const documentGroups = await getDb(env.DB)
        .select({ groupId: groups.id, libraryId: groups.libraryId })
        .from(groups)
        .where(eq(groups.documentId, documentId));
    const session = await chooseLoadSession(
        env,
        documentId,
        versionId,
        documentGroups.map((group) => group.libraryId)
    );
    if (!session) {
        console.warn(`No live session to reload ${documentId} with.`);
        await flagGroups(
            env,
            documentGroups.map((group) => group.groupId),
            BuildIssueType.VERSION_NOT_LOADED
        );
        await publishLibraries(
            env,
            documentGroups.map((group) => group.libraryId)
        );
        return;
    }
    await requestLoads(
        env,
        documentGroups.map((group) => ({
            ...group,
            sessionId: session.sessionId,
            forceReload: false,
            origin
        }))
    );
}

async function chooseLoadSession(
    env: AppBindings,
    documentId: string,
    versionId: string | undefined,
    libraryIds: string[]
): Promise<UserSession | undefined> {
    const fallback =
        (await getOwnerSession(env)) ??
        (await getAdminSession(env, libraryIds));
    if (!fallback || !versionId) {
        return fallback;
    }
    // The version's creator can only be read with a session that works.
    const creatorId = await getVersion(
        fallback.onshapeApi,
        { documentId },
        versionId
    )
        .then((version) => version.creator?.id)
        .catch(() => undefined);
    const creator = creatorId
        ? await getLiveSession(env.KV, creatorId)
        : undefined;
    return creator ?? fallback;
}

/** Any admin of the libraries holding the document, for when the owner's session is gone. */
async function getAdminSession(
    env: AppBindings,
    libraryIds: string[]
): Promise<UserSession | undefined> {
    if (libraryIds.length === 0) {
        return undefined;
    }
    const admins = await getDb(env.DB)
        .selectDistinct({ userId: adminTeamMembers.userId })
        .from(adminTeamMembers)
        .where(inArray(adminTeamMembers.libraryId, libraryIds as LibraryId[]));
    for (const { userId } of admins) {
        const session = await getLiveSession(env.KV, userId);
        if (session) {
            return session;
        }
    }
    return undefined;
}

/** Pulls the team's members again for every library it administers. */
async function resyncTeam(env: AppBindings, teamId: string): Promise<void> {
    const onshapeApi = (await getOwnerSession(env))?.onshapeApi;
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

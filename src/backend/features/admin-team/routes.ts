import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { getApp } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { type Db, getDb } from "../../db/client";
import { libraries, WebhookSubject } from "../../db/schema";
import { runInBackground } from "../../lib/background";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getTeam,
    OnshapeOwnerType,
    type OnshapeTeamInfo
} from "../../lib/onshape/endpoints/teams";
import { ensureWebhook, removeWebhook } from "../webhooks/registration";
import {
    requireAdminMiddleware,
    requireEditorMiddleware,
    requireOwnerMiddleware
} from "../auth/guards";
import { ensureLibrary } from "../library/db";
import type { LibraryId } from "../library/library-id";
import type { AdminTeamOut } from "./contract";
import { syncAdminTeam } from "./sync";

export const adminTeamRoutes = getApp();

const setAdminTeamBody = z.object({
    /** Null takes the team away, leaving only the owner able to edit. */
    teamId: z.string().trim().min(1).nullable()
});

async function readTeam(
    onshapeApi: OnshapeApi,
    teamId: string
): Promise<OnshapeTeamInfo> {
    try {
        return await getTeam(onshapeApi, teamId);
    } catch (error) {
        console.error(`Failed to read team ${teamId}`, error);
        throw handledError(UNREADABLE_TEAM, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}

/** Whether any library still has the team, so its webhook is still wanted. */
async function isAdminTeam(db: Db, teamId: string): Promise<boolean> {
    const row = await db
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.adminTeamId, teamId))
        .get();
    return row !== undefined;
}

async function getAdminTeam(
    db: Db,
    libraryId: LibraryId
): Promise<AdminTeamOut> {
    const library = await db
        .select({
            teamId: libraries.adminTeamId,
            members: libraries.adminTeam
        })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();
    return {
        teamId: library?.teamId ?? undefined,
        memberCount: library?.members.length ?? 0
    };
}

/** GET /api/admin-team/library/:libraryId */
adminTeamRoutes.get(
    "/admin-team" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => c.json(await getAdminTeam(getDb(c.env.DB), getLibraryParam(c)))
);

const UNREADABLE_TEAM =
    "Couldn't read that team's members from Onshape. Check the team id.";

/**
 * POST /api/admin-team/library/:libraryId: sets the team, pulls its members,
 * and watches it for changes. Only a company's team, an enterprise's or a
 * classroom's, can be watched; one owned by a person is an old kind Onshape
 * no longer creates, so it is refused.
 */
adminTeamRoutes.post(
    "/admin-team" + libraryRoute(),
    requireOwnerMiddleware,
    validate("json", setAdminTeamBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { teamId } = c.req.valid("json");
        const db = getDb(c.env.DB);
        const onshapeApi = await c.var.getOnshapeApi();

        const team = teamId ? await readTeam(onshapeApi, teamId) : undefined;
        if (team && team.owner.type !== OnshapeOwnerType.COMPANY) {
            throw handledError(
                "That team belongs to a person rather than a classroom or company, so Onshape can't say when its members change. Use a team that belongs to a classroom or company.",
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        await ensureLibrary(db, libraryId);
        const previous = (await getAdminTeam(db, libraryId)).teamId;
        const setTeam = (adminTeamId: string | undefined) =>
            db
                .update(libraries)
                // Drizzle skips an undefined field, so clearing takes null.
                .set({ adminTeamId: adminTeamId ?? null })
                .where(eq(libraries.id, libraryId));

        await setTeam(teamId ?? undefined);
        try {
            await syncAdminTeam(c.env, onshapeApi, libraryId);
        } catch (error) {
            // Usually a typo, so keep the team that worked.
            await setTeam(previous);
            console.error(`Failed to read team ${teamId}`, error);
            throw handledError(
                UNREADABLE_TEAM,
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        // The team is set either way; a webhook that won't register leaves the refresh button.
        await runInBackground(c, "watch the admin team", async () => {
            if (team) {
                await ensureWebhook(
                    c.env,
                    onshapeApi,
                    WebhookSubject.TEAM,
                    team.id,
                    team.owner.id
                );
            }
            if (
                previous &&
                previous !== teamId &&
                !(await isAdminTeam(db, previous))
            ) {
                await removeWebhook(
                    c.env,
                    onshapeApi,
                    WebhookSubject.TEAM,
                    previous
                );
            }
        });

        return c.json(await getAdminTeam(db, libraryId));
    }
);

/**
 * POST /api/admin-team/refresh/library/:libraryId: pulls the team's members
 * again, for a change Onshape's webhook didn't deliver.
 */
adminTeamRoutes.post(
    "/admin-team/refresh" + libraryRoute(),
    requireAdminMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        await syncAdminTeam(c.env, await c.var.getOnshapeApi(), libraryId);
        return c.json(await getAdminTeam(getDb(c.env.DB), libraryId));
    }
);

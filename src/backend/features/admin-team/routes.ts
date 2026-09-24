import { count, eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { getApp } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { type Db, getDb } from "../../db/client";
import { adminTeamMembers, libraries, WebhookSubject } from "../../db/schema";
import { requireOwnerMiddleware } from "../auth/guards";
import { ensureLibrary } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { ensureWebhook, removeWebhook } from "../webhooks/registration";
import type { AdminTeamOut } from "./contract";
import { librariesOfTeam, syncAdminTeam } from "./sync";

export const adminTeamRoutes = getApp();

const setAdminTeamBody = z.object({
    /** Null takes the team away, leaving only the owner able to edit. */
    teamId: z.string().trim().min(1).nullable()
});

async function getAdminTeam(
    db: Db,
    libraryId: LibraryId
): Promise<AdminTeamOut> {
    const [library, members] = await Promise.all([
        db
            .select({ teamId: libraries.adminTeamId })
            .from(libraries)
            .where(eq(libraries.id, libraryId))
            .get(),
        db
            .select({ count: count() })
            .from(adminTeamMembers)
            .where(eq(adminTeamMembers.libraryId, libraryId))
            .get()
    ]);
    return {
        teamId: library?.teamId ?? undefined,
        memberCount: members?.count ?? 0
    };
}

/** GET /api/admin-team/library/:libraryId */
adminTeamRoutes.get(
    "/admin-team" + libraryRoute(),
    requireOwnerMiddleware,
    async (c) => c.json(await getAdminTeam(getDb(c.env.DB), getLibraryParam(c)))
);

/** POST /api/admin-team/library/:libraryId: sets the team, pulls its members, registers its webhook. */
adminTeamRoutes.post(
    "/admin-team" + libraryRoute(),
    requireOwnerMiddleware,
    validate("json", setAdminTeamBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { teamId } = c.req.valid("json");
        const db = getDb(c.env.DB);
        const onshapeApi = await c.var.getOnshapeApi();

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
                "Couldn't read that team's members from Onshape. Check the team id.",
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        const origin = new URL(c.req.url).origin;
        if (teamId) {
            await ensureWebhook(
                c.env,
                onshapeApi,
                WebhookSubject.TEAM,
                teamId,
                origin
            );
        }
        if (
            previous &&
            previous !== teamId &&
            (await librariesOfTeam(c.env, previous)).length === 0
        ) {
            await removeWebhook(
                c.env,
                onshapeApi,
                WebhookSubject.TEAM,
                previous
            );
        }
        return c.json(await getAdminTeam(db, libraryId));
    }
);

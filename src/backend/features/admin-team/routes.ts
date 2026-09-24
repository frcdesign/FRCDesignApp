import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { getApp } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { type Db, getDb } from "../../db/client";
import { libraries } from "../../db/schema";
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

/** POST /api/admin-team/library/:libraryId: sets the team and pulls its members. */
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

        return c.json(await getAdminTeam(db, libraryId));
    }
);

/**
 * POST /api/admin-team/refresh/library/:libraryId: pulls the team's members
 * again. Onshape's team webhooks need a company, which a personal account
 * lacks, so a change in Onshape waits for this.
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

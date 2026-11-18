/** A team's favorites: a user's favorites' shape and flows, owned by the team. */
import { and, asc, count, eq, max } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { type Db, getDb } from "../../db/client";
import { teamFavorites } from "../../db/schema";
import { handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import {
    getInsertableConfigurations,
    getParametersFor,
    resolveStoredSelection
} from "../configurations/stored-selections";
import { toSelection, toStoredSelection } from "../configurations/selection";
import type { Favorite, FavoritesData } from "../favorites/contract";
import type { LibraryId } from "../library/library-id";
import { MAX_TEAM_FAVORITES } from "./contract";
import {
    getRequiredParam,
    getTeamParam,
    requireTeamFavoritesEditorMiddleware,
    requireTeamMemberMiddleware,
    teamRoute
} from "./guards";

export const teamFavoriteRoutes = getApp();

async function getTeamFavorites(
    db: Db,
    teamId: string,
    libraryId: LibraryId
): Promise<FavoritesData> {
    const rows = await db
        .select()
        .from(teamFavorites)
        .where(
            and(
                eq(teamFavorites.teamId, teamId),
                eq(teamFavorites.libraryId, libraryId)
            )
        )
        .orderBy(asc(teamFavorites.sortOrder))
        .all();
    const configurationsById = await getInsertableConfigurations(
        db,
        rows.map((row) => row.insertableId)
    );
    const favorites: Record<string, Favorite> = {};
    for (const row of rows) {
        const { selection, configurationKey, record } = resolveStoredSelection(
            row.defaultSelection ?? undefined,
            configurationsById.get(row.insertableId)
        );
        favorites[row.id] = {
            id: row.id,
            insertableId: row.insertableId,
            libraryId,
            defaultSelection: selection,
            configurationKey,
            record
        };
    }
    return { favorites, favoriteOrder: rows.map((row) => row.id) };
}

/** GET /api/teams/:teamId/favorites/library/:libraryId */
teamFavoriteRoutes.get(
    teamRoute() + "/favorites" + libraryRoute(),
    requireTeamMemberMiddleware,
    cacheMiddleware(),
    async (c) =>
        c.json(
            await getTeamFavorites(
                getDb(c.env.DB),
                getTeamParam(c),
                getLibraryParam(c)
            )
        )
);

const addQuery = z.object({
    insertableId: z.string().min(1),
    id: z.string().min(1)
});

const addBody = z.object({
    selection: z.record(z.string(), z.string()).optional()
});

/** POST /api/teams/:teamId/favorites/library/:libraryId?insertableId=&id= */
teamFavoriteRoutes.post(
    teamRoute() + "/favorites" + libraryRoute(),
    requireTeamFavoritesEditorMiddleware,
    validate("query", addQuery),
    validate("json", addBody),
    async (c) => {
        const teamId = getTeamParam(c);
        const libraryId = getLibraryParam(c);
        const { insertableId, id } = c.req.valid("query");
        const { selection } = c.req.valid("json");
        const db = getDb(c.env.DB);

        const existing = await db
            .select({
                value: count(),
                highestOrder: max(teamFavorites.sortOrder)
            })
            .from(teamFavorites)
            .where(
                and(
                    eq(teamFavorites.teamId, teamId),
                    eq(teamFavorites.libraryId, libraryId)
                )
            )
            .get();
        if ((existing?.value ?? 0) >= MAX_TEAM_FAVORITES) {
            throw handledError(
                `A team can keep up to ${MAX_TEAM_FAVORITES} favorites in a library.`,
                HttpStatus.CONFLICT
            );
        }
        const parameters = selection
            ? await getParametersFor(db, insertableId)
            : [];
        await db
            .insert(teamFavorites)
            .values({
                id,
                teamId,
                libraryId,
                insertableId,
                defaultSelection: selection
                    ? toStoredSelection(
                          toSelection(selection, parameters),
                          parameters
                      )
                    : undefined,
                sortOrder: (existing?.highestOrder ?? -1) + 1,
                createdBy: await c.var.getUserId(),
                createdAt: new Date()
            })
            .onConflictDoNothing();
        return c.json({ success: true });
    }
);

/** DELETE /api/teams/:teamId/favorites/:favoriteId */
teamFavoriteRoutes.delete(
    teamRoute() + "/favorites/:favoriteId",
    requireTeamFavoritesEditorMiddleware,
    async (c) => {
        // Scoped to the team, so another team's favorite matches nothing.
        await getDb(c.env.DB)
            .delete(teamFavorites)
            .where(
                and(
                    eq(teamFavorites.id, getRequiredParam(c, "favoriteId")),
                    eq(teamFavorites.teamId, getTeamParam(c))
                )
            );
        return c.json({ success: true });
    }
);

const orderBody = z.object({
    favoriteOrder: z.array(z.string()).max(MAX_TEAM_FAVORITES)
});

/** POST /api/teams/:teamId/favorite-order/library/:libraryId */
teamFavoriteRoutes.post(
    teamRoute() + "/favorite-order" + libraryRoute(),
    requireTeamFavoritesEditorMiddleware,
    validate("json", orderBody),
    async (c) => {
        const teamId = getTeamParam(c);
        const { favoriteOrder } = c.req.valid("json");
        const db = getDb(c.env.DB);
        const writes = favoriteOrder.map((id, index) =>
            db
                .update(teamFavorites)
                .set({ sortOrder: index })
                .where(
                    and(
                        eq(teamFavorites.id, id),
                        eq(teamFavorites.teamId, teamId)
                    )
                )
        );
        if (writes.length > 0) {
            await db.batch([writes[0], ...writes.slice(1)]);
        }
        return c.json({ success: true });
    }
);

import { and, asc, eq } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { type Db, getDb } from "../db";
import { users, favorites } from "../../shared/schema";
import { type Favorite, type FavoritesData } from "../../shared/api-models";
import { type LibraryId } from "../../shared/types";
import { HttpStatus } from "http-status-ts";
import { type ParameterValues } from "../../shared/configuration-models";

export const favoriteRoutes = getApp();

async function getFavorites(
    db: Db,
    userId: string,
    libraryId: LibraryId
): Promise<FavoritesData> {
    const rows = await db
        .select()
        .from(favorites)
        .where(
            and(
                eq(favorites.userId, userId),
                eq(favorites.libraryId, libraryId)
            )
        )
        .orderBy(asc(favorites.sortOrder))
        .all();

    const favoritesOut: Record<string, Favorite> = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        const fav: Favorite = {
            id: row.id,
            insertableId: row.insertableId,
            libraryId,
            defaultConfiguration: row.defaultConfiguration ?? undefined
        };
        favoritesOut[row.id] = fav;
        favoriteOrder.push(row.id);
    }
    return { favorites: favoritesOut, favoriteOrder };
}

/**
 * Gets the list of a user's favorites.
 */
favoriteRoutes.get("/favorites" + libraryRoute(), async (c) => {
    const userId = await c.var.getUserId();
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getFavorites(db, userId, libraryId));
});

/**
 * Creates a new favorite.
 */
favoriteRoutes.post("/favorites" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const userId = await c.var.getUserId();
    const insertableId = c.req.query("insertableId");
    const favoriteId = c.req.query("id");
    if (!insertableId)
        return c.json(
            { error: "insertableId required" },
            HttpStatus.BAD_REQUEST
        );
    if (!favoriteId)
        return c.json({ error: "id required" }, HttpStatus.BAD_REQUEST);

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    const existingCount = await db
        .select({ sortOrder: favorites.sortOrder })
        .from(favorites)
        .where(
            and(
                eq(favorites.userId, userId),
                eq(favorites.libraryId, libraryId)
            )
        )
        .all();

    await db
        .insert(favorites)
        .values({
            id: favoriteId,
            userId,
            libraryId,
            insertableId,
            sortOrder: existingCount.length
        })
        .onConflictDoNothing();

    return c.json({ success: true });
});

/**
 * Deletes  a user's favorites.
 */
favoriteRoutes.delete("/favorites/:favoriteId", async (c) => {
    const favoriteId = c.req.param("favoriteId");
    if (!favoriteId) {
        return c.json(
            { error: "favoriteId is required" },
            HttpStatus.BAD_REQUEST
        );
    }
    const userId = await c.var.getUserId();
    const db = getDb(c.env.DB);

    // security: Require the user to also match
    await db
        .delete(favorites)
        .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, userId)));

    return c.json({ success: true });
});

/** POST /api/favorite-order/library/:libraryId */
favoriteRoutes.post("/favorite-order" + libraryRoute(), async (c) => {
    const body = await c.req.json<{ favoriteOrder: string[] }>();

    const db = getDb(c.env.DB);
    await Promise.all(
        body.favoriteOrder.map((id, i) =>
            db
                .update(favorites)
                .set({ sortOrder: i })
                .where(eq(favorites.id, id))
        )
    );

    return c.json({ success: true });
});

/** POST /api/default-configuration/:favoriteId */
favoriteRoutes.post("/default-configuration/:favoriteId", async (c) => {
    const favoriteId = c.req.param("favoriteId");
    const body = await c.req.json<{
        defaultConfiguration: ParameterValues;
    }>();

    const db = getDb(c.env.DB);
    await db
        .update(favorites)
        .set({ defaultConfiguration: body.defaultConfiguration })
        .where(eq(favorites.id, favoriteId));

    return c.json({ success: true });
});

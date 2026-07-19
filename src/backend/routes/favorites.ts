import { and, asc, eq } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { type Db, getDb } from "../db";
import { users, favorites } from "../../shared/schema";
import { type Favorite, type FavoritesData } from "../../shared/api-models";
import { type LibraryId } from "../../shared/types";
import { type Configuration } from "../../shared/configuration-models";

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
            defaultConfiguration: row.defaultConfiguration ?? undefined,
            name: row.name ?? undefined
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
    const name = c.req.query("name");
    if (!insertableId) return c.json({ error: "insertableId required" }, 400);
    if (!favoriteId) return c.json({ error: "id required" }, 400);
    if (!name) return c.json({ error: "name required" }, 400);
    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    const existingFavorites = await db.$count(
        favorites,
        and(eq(favorites.userId, userId), eq(favorites.libraryId, libraryId))
    );

    await db
        .insert(favorites)
        .values({
            id: favoriteId,
            userId,
            libraryId,
            insertableId,
            name,
            sortOrder: existingFavorites
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
        return c.json({ error: "favoriteId is required" }, 400);
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

/** POST /api/favorites/:favoriteId */
favoriteRoutes.post("/favorites/:favoriteId", async (c) => {
    const favoriteId = c.req.param("favoriteId");
    const body = await c.req.json<{
        defaultConfiguration?: Configuration | null;
        name?: string;
    }>();

    if (!favoriteId) {
        return c.json({ error: "favoriteId is required" }, 400);
    }

    if (Object.keys(body).length === 0) {
        return c.json(
            { error: "defaultConfiguration or name is required" },
            400
        );
    }

    const db = getDb(c.env.DB);

    if (Object.keys(body).length > 0) {
        await db
            .update(favorites)
            .set(body)
            .where(eq(favorites.id, favoriteId));
    }

    return c.json({ success: true });
});

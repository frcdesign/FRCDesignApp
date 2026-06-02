import { and, asc, eq } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getUserId } from "../onshape-api/endpoints/users";
import { users, favorites } from "../../shared/schema";
import { type Favorite, type FavoritesData } from "../../shared/api-models";
import { type Library } from "../../shared/types";
import { type Configuration } from "../../shared/configuration-models";

export const favoriteRoutes = getApp();

async function getFavorites(
    db: ReturnType<typeof getDb>,
    userId: string,
    library: Library
): Promise<FavoritesData> {
    const rows = await db
        .select()
        .from(favorites)
        .where(
            and(eq(favorites.userId, userId), eq(favorites.libraryId, library))
        )
        .orderBy(asc(favorites.sortOrder))
        .all();

    const favoritesOut: Record<string, Favorite> = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        const fav: Favorite = {
            id: row.id,
            insertableId: row.insertableId,
            library,
            defaultConfiguration: row.defaultConfiguration ?? undefined
        };
        favoritesOut[row.id] = fav;
        favoriteOrder.push(row.id);
    }
    return { favorites: favoritesOut, favoriteOrder };
}

/** GET /api/favorites/library/:library */
favoriteRoutes.get("/favorites" + libraryRoute(), async (c) => {
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const library = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getFavorites(db, userId, library));
});

/** POST /api/favorites/library/:library */
favoriteRoutes.post("/favorites" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const insertableId = c.req.query("insertableId");
    const id = c.req.query("id");
    if (!insertableId) return c.json({ error: "insertableId required" }, 400);
    if (!id) return c.json({ error: "id required" }, 400);

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    const existingCount = await db
        .select({ sortOrder: favorites.sortOrder })
        .from(favorites)
        .where(
            and(eq(favorites.userId, userId), eq(favorites.libraryId, library))
        )
        .all();

    await db
        .insert(favorites)
        .values({
            id,
            userId,
            libraryId: library,
            insertableId,
            sortOrder: existingCount.length
        })
        .onConflictDoNothing();

    return c.json({ success: true });
});

/** DELETE /api/favorites/:favoriteId */
favoriteRoutes.delete("/favorites/:favoriteId", async (c) => {
    const favoriteId = c.req.param("favoriteId");
    const db = getDb(c.env.DB);
    await db.delete(favorites).where(eq(favorites.id, favoriteId));
    return c.json({ success: true });
});

/** POST /api/favorite-order/library/:library */
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
        defaultConfiguration: Configuration;
    }>();

    const db = getDb(c.env.DB);
    await db
        .update(favorites)
        .set({ defaultConfiguration: body.defaultConfiguration })
        .where(eq(favorites.id, favoriteId));

    return c.json({ success: true });
});

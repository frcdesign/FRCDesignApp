import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { type AppBindings, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getUserId } from "../onshape-api/endpoints/users";
import { users, favorites } from "../../shared/schema";
import {
    type Favorite,
    type Favorites,
    type FavoritesData
} from "../../shared/api-models";
import { type Library } from "../../shared/types";
import { type Configuration } from "../../shared/configuration-models";

export const favoriteRoutes = new Hono<{ Bindings: AppBindings }>();

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

    const favoritesOut: Favorites = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        favoritesOut[row.insertableId] = {
            id: row.insertableId,
            library,
            defaultConfiguration: row.defaultConfiguration ?? undefined
        } satisfies Favorite;
        favoriteOrder.push(row.insertableId);
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
    if (!insertableId) return c.json({ error: "insertableId required" }, 400);

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
            userId,
            libraryId: library,
            insertableId,
            sortOrder: existingCount.length
        })
        .onConflictDoNothing();

    return c.json({ success: true });
});

/** DELETE /api/favorites/library/:library */
favoriteRoutes.delete("/favorites" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const insertableId = c.req.query("insertableId");
    if (!insertableId) return c.json({ error: "insertableId required" }, 400);

    const db = getDb(c.env.DB);
    await db
        .delete(favorites)
        .where(
            and(
                eq(favorites.userId, userId),
                eq(favorites.libraryId, library),
                eq(favorites.insertableId, insertableId)
            )
        );

    return c.json({ success: true });
});

/** POST /api/favorite-order/library/:library */
favoriteRoutes.post("/favorite-order" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const body = await c.req.json<{ favoriteOrder: string[] }>();

    const db = getDb(c.env.DB);
    await Promise.all(
        body.favoriteOrder.map((insertableId, i) =>
            db
                .update(favorites)
                .set({ sortOrder: i })
                .where(
                    and(
                        eq(favorites.userId, userId),
                        eq(favorites.libraryId, library),
                        eq(favorites.insertableId, insertableId)
                    )
                )
        )
    );

    return c.json({ success: true });
});

/** POST /api/default-configuration/library/:library */
favoriteRoutes.post("/default-configuration" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const body = await c.req.json<{
        insertableId: string;
        defaultConfiguration: Configuration;
    }>();

    const db = getDb(c.env.DB);
    await db
        .update(favorites)
        .set({ defaultConfiguration: body.defaultConfiguration })
        .where(
            and(
                eq(favorites.userId, userId),
                eq(favorites.libraryId, library),
                eq(favorites.insertableId, body.insertableId)
            )
        );

    return c.json({ success: true });
});

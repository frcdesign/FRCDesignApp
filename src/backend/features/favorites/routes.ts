import { and, asc, eq } from "drizzle-orm";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import {
    favoriteRoute,
    getFavoriteParam,
    getLibraryParam,
    libraryRoute
} from "../../lib/route-params";
import { type Db, getDb } from "../../db/client";
import { users, favorites } from "../../db/schema";
import type { Favorite, FavoritesData } from "./contract";
import type { LibraryId } from "../library/library-id";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";

export const favoriteRoutes = getApp();

const addFavoriteQuery = z.object({
    insertableId: z.string().min(1),
    id: z.string().min(1)
});

const favoriteOrderBody = z.object({ favoriteOrder: z.array(z.string()) });

const defaultConfigurationBody = z.object({
    defaultConfiguration: z.record(z.string(), z.string())
});

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

/** GET /api/favorites/library/:libraryId */
favoriteRoutes.get(
    "/favorites" + libraryRoute(),
    requireSignInMiddleware,
    cacheMiddleware(),
    async (c) => {
        const userId = await c.var.getUserId();
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        return c.json(await getFavorites(db, userId, libraryId));
    }
);

/** POST /api/favorites/library/:libraryId */
favoriteRoutes.post(
    "/favorites" + libraryRoute(),
    requireSignInMiddleware,
    validate("query", addFavoriteQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const userId = await c.var.getUserId();
        const { insertableId, id: favoriteId } = c.req.valid("query");

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
    }
);

/** DELETE /api/favorite/:favoriteId */
favoriteRoutes.delete(favoriteRoute(), requireSignInMiddleware, async (c) => {
    const favoriteId = getFavoriteParam(c);
    const userId = await c.var.getUserId();
    const db = getDb(c.env.DB);

    // Scoped to the owner, so another user's favorite matches nothing.
    await db
        .delete(favorites)
        .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, userId)));

    return c.json({ success: true });
});

/** POST /api/favorite-order/library/:libraryId */
favoriteRoutes.post(
    "/favorite-order" + libraryRoute(),
    requireSignInMiddleware,
    validate("json", favoriteOrderBody),
    async (c) => {
        const { favoriteOrder } = c.req.valid("json");
        const userId = await c.var.getUserId();

        const db = getDb(c.env.DB);
        // Scoped to the owner rather than checked first: a favorite that is not
        // theirs matches nothing, which costs no extra read.
        await Promise.all(
            favoriteOrder.map((id, i) =>
                db
                    .update(favorites)
                    .set({ sortOrder: i })
                    .where(
                        and(eq(favorites.id, id), eq(favorites.userId, userId))
                    )
            )
        );

        return c.json({ success: true });
    }
);

/** POST /api/default-configuration/favorite/:favoriteId */
favoriteRoutes.post(
    "/default-configuration" + favoriteRoute(),
    requireSignInMiddleware,
    validate("json", defaultConfigurationBody),
    async (c) => {
        const favoriteId = getFavoriteParam(c);
        const { defaultConfiguration } = c.req.valid("json");
        const userId = await c.var.getUserId();

        const db = getDb(c.env.DB);
        await db
            .update(favorites)
            .set({ defaultConfiguration })
            .where(
                and(eq(favorites.id, favoriteId), eq(favorites.userId, userId))
            );

        return c.json({ success: true });
    }
);

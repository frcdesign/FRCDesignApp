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

/** The configuration the favorite opens with, when it was made from one. */
const addFavoriteBody = z.object({
    canonicalConfiguration: z.string().optional()
});

const favoriteOrderBody = z.object({ favoriteOrder: z.array(z.string()) });

const canonicalConfigurationBody = z.object({
    canonicalConfiguration: z.string()
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
            canonicalConfiguration: row.canonicalConfiguration ?? undefined
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
    validate("json", addFavoriteBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const userId = await c.var.getUserId();
        const { insertableId, id: favoriteId } = c.req.valid("query");
        const { canonicalConfiguration } = c.req.valid("json");

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
                canonicalConfiguration,
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

/** POST /api/canonical-configuration/favorite/:favoriteId */
favoriteRoutes.post(
    "/canonical-configuration" + favoriteRoute(),
    requireSignInMiddleware,
    validate("json", canonicalConfigurationBody),
    async (c) => {
        const favoriteId = getFavoriteParam(c);
        const { canonicalConfiguration } = c.req.valid("json");
        const userId = await c.var.getUserId();

        const db = getDb(c.env.DB);
        await db
            .update(favorites)
            .set({ canonicalConfiguration })
            .where(
                and(eq(favorites.id, favoriteId), eq(favorites.userId, userId))
            );

        return c.json({ success: true });
    }
);

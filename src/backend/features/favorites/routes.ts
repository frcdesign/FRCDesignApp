import { and, asc, count, eq, max } from "drizzle-orm";
import { handledError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";
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
import {
    getInsertableConfigurations,
    getParametersFor,
    resolveStoredSelection,
    toRowSelection
} from "../configurations/stored-selections";
import { MAX_FAVORITES, type Favorite, type FavoritesData } from "./contract";
import type { LibraryId } from "../library/library-id";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";

export const favoriteRoutes = getApp();

const addFavoriteQuery = z.object({
    insertableId: z.string().min(1),
    id: z.string().min(1)
});

/** The selection the favorite opens with, when it was made from one. */
const addFavoriteBody = z.object({
    selection: z.record(z.string(), z.string()).optional()
});

const favoriteOrderBody = z.object({
    favoriteOrder: z.array(z.string()).max(MAX_FAVORITES)
});

const defaultSelectionBody = z.object({
    selection: z.record(z.string(), z.string())
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

    const configurationsById = await getInsertableConfigurations(
        db,
        rows.map((row) => row.insertableId)
    );

    const favoritesOut: Record<string, Favorite> = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        const { selection, configurationKey, record } = resolveStoredSelection(
            row.defaultSelection ?? undefined,
            configurationsById.get(row.insertableId)
        );
        favoritesOut[row.id] = {
            id: row.id,
            insertableId: row.insertableId,
            libraryId,
            defaultSelection: selection,
            configurationKey,
            record
        };
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
        const { selection } = c.req.valid("json");

        const db = getDb(c.env.DB);

        // The favorite references a user row, which a new caller doesn't have yet.
        // The library is named since the dead column's default may not exist.
        await db
            .insert(users)
            .values({ id: userId, libraryId })
            .onConflictDoNothing();

        // The highest order, not the count: deletes leave gaps.
        const existing = await db
            .select({
                value: count(),
                highestOrder: max(favorites.sortOrder)
            })
            .from(favorites)
            .where(
                and(
                    eq(favorites.userId, userId),
                    eq(favorites.libraryId, libraryId)
                )
            )
            .get();

        const sortOrder = (existing?.highestOrder ?? -1) + 1;
        if ((existing?.value ?? 0) >= MAX_FAVORITES) {
            throw handledError(
                `You can keep up to ${MAX_FAVORITES} favorites in a library. Remove one to add another.`,
                HttpStatus.CONFLICT
            );
        }

        await db
            .insert(favorites)
            .values({
                id: favoriteId,
                userId,
                libraryId,
                insertableId,
                defaultSelection: selection
                    ? toRowSelection(
                          selection,
                          await getParametersFor(db, insertableId)
                      )
                    : undefined,
                sortOrder,
                createdAt: new Date()
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
        // Scoped to the owner, so someone else's favorite matches nothing.
        const writes = favoriteOrder.map((id, i) =>
            db
                .update(favorites)
                .set({ sortOrder: i })
                .where(and(eq(favorites.id, id), eq(favorites.userId, userId)))
        );
        // One round trip for the whole reorder; `batch` will not take an empty one.
        if (writes.length > 0) {
            await db.batch([writes[0], ...writes.slice(1)]);
        }

        return c.json({ success: true });
    }
);

/** POST /api/default-selection/favorite/:favoriteId */
favoriteRoutes.post(
    "/default-selection" + favoriteRoute(),
    requireSignInMiddleware,
    validate("json", defaultSelectionBody),
    async (c) => {
        const favoriteId = getFavoriteParam(c);
        const { selection } = c.req.valid("json");
        const userId = await c.var.getUserId();

        const db = getDb(c.env.DB);
        const row = await db
            .select({ insertableId: favorites.insertableId })
            .from(favorites)
            .where(
                and(eq(favorites.id, favoriteId), eq(favorites.userId, userId))
            )
            .get();
        if (!row) {
            return c.json({ success: true });
        }

        await db
            .update(favorites)
            .set({
                defaultSelection: toRowSelection(
                    selection,
                    await getParametersFor(db, row.insertableId)
                )
            })
            .where(
                and(eq(favorites.id, favoriteId), eq(favorites.userId, userId))
            );

        return c.json({ success: true });
    }
);

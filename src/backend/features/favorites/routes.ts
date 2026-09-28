import { and, asc, count, eq, inArray, max } from "drizzle-orm";
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
import { chunkForInArray } from "../../db/chunk";
import { users, favorites, configurations, insertables } from "../../db/schema";
import {
    findRecord,
    toKey,
    toSelection,
    toStoredSelection
} from "../configurations/selection";
import { MAX_FAVORITES, type Favorite, type FavoritesData } from "./contract";
import {
    type ConfigurationParameter,
    type PartialSelection,
    type SearchRecord
} from "../configurations/contract";
import { searchRecordsOf } from "../search/records";
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

    // Computed, not stored: a reload can move the defaults a key is measured against.
    const configurationsById = await getConfigurations(
        db,
        rows.map((row) => row.insertableId)
    );

    const favoritesOut: Record<string, Favorite> = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        const { parameters = [], records = [] } =
            configurationsById.get(row.insertableId) ?? {};
        // A row written before a parameter existed still has to be whole.
        const defaultSelection = row.defaultSelection
            ? toSelection(
                  toStoredSelection(row.defaultSelection, parameters),
                  parameters
              )
            : undefined;
        const fav: Favorite = {
            id: row.id,
            insertableId: row.insertableId,
            libraryId,
            defaultSelection,
            configurationKey: defaultSelection
                ? toKey(defaultSelection, parameters)
                : undefined,
            // So a row never shows another configuration's part number.
            record: findRecord(
                defaultSelection ?? toSelection({}, parameters),
                records
            )
        };
        favoritesOut[row.id] = fav;
        favoriteOrder.push(row.id);
    }
    return { favorites: favoritesOut, favoriteOrder };
}

function toFavoriteSelection(
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): PartialSelection {
    return toStoredSelection(toSelection(selection, parameters), parameters);
}

/** One insertable's parameters, for making a selection whole. */
async function getParametersFor(
    db: Db,
    insertableId: string
): Promise<ConfigurationParameter[]> {
    return (
        (await getConfigurations(db, [insertableId])).get(insertableId)
            ?.parameters ?? []
    );
}

/** What a favorite's insertable contributes to the response. */
interface InsertableConfiguration {
    /** What a stored selection is made whole against. */
    parameters: ConfigurationParameter[];
    /** Includes the element's own. */
    records: SearchRecord[];
}

/**
 * Joined with the insertable, whose vendors give a record its url. A left join,
 * since an unconfigurable insertable has no configurations row.
 */
async function getConfigurations(
    db: Db,
    insertableIds: string[]
): Promise<Map<string, InsertableConfiguration>> {
    // Chunked: there can be more favorites than one statement binds.
    const reads = await Promise.all(
        chunkForInArray(insertableIds).map((ids) =>
            db
                .select({
                    insertableId: insertables.id,
                    vendors: insertables.vendors,
                    partMetadata: insertables.partMetadata,
                    parameters: configurations.parameters,
                    records: configurations.records
                })
                .from(insertables)
                .leftJoin(
                    configurations,
                    eq(configurations.insertableId, insertables.id)
                )
                .where(inArray(insertables.id, ids))
                .all()
        )
    );
    return new Map(
        reads.flat().map((row) => {
            return [
                row.insertableId,
                {
                    parameters: row.parameters ?? [],
                    records: searchRecordsOf(row)
                }
            ];
        })
    );
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
                    ? toFavoriteSelection(
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
                defaultSelection: toFavoriteSelection(
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

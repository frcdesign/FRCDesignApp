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
import { users, favorites, configurations, insertables } from "../../db/schema";
import { toKey, toSelection } from "../configurations/selection";
import { MAX_FAVORITES, type Favorite, type FavoritesData } from "./contract";
import {
    DEFAULT_CONFIGURATION_KEY,
    type ConfigurationParameter,
    type SearchRecord
} from "../configurations/contract";
import { findRecordForConfiguration } from "../configurations/utils";
import { toSearchRecords } from "../search/records";
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

    // Keyed here rather than stored: the parameters a selection is canonical
    // against move with the library, and only the row is ours to keep.
    const configurationsById = await getConfigurations(
        db,
        rows.map((row) => row.insertableId)
    );

    const favoritesOut: Record<string, Favorite> = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        const { parameters = [], records = [] } =
            configurationsById.get(row.insertableId) ?? {};
        const stored = row.defaultSelection ?? undefined;
        // Made whole on the way out as well as in: a row written before a
        // parameter existed still has to answer as a selection.
        const defaultSelection = stored
            ? toSelection(stored, parameters)
            : undefined;
        // A favorite storing no selection opens on the element's own defaults,
        // which is what the empty key names — so it resolves the right record
        // while the field itself stays absent, as the contract has it.
        const configurationKey = defaultSelection
            ? toKey(defaultSelection, parameters)
            : DEFAULT_CONFIGURATION_KEY;
        const fav: Favorite = {
            id: row.id,
            insertableId: row.insertableId,
            libraryId,
            defaultSelection,
            configurationKey: defaultSelection ? configurationKey : undefined,
            // The record this favorite's own selection produces, so a row can
            // never show a part number belonging to another configuration.
            record: findRecordForConfiguration(configurationKey, records)
        };
        favoritesOut[row.id] = fav;
        favoriteOrder.push(row.id);
    }
    return { favorites: favoritesOut, favoriteOrder };
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

/** The parameters of each insertable named, for keying against. */
/** What a favorite's insertable contributes to the response. */
interface InsertableConfiguration {
    /** What a stored selection is made whole and canonical against. */
    parameters: ConfigurationParameter[];
    /** What each configuration is called, for the one this favorite names. */
    records: SearchRecord[];
}

/**
 * Joined from the insertable rather than the configurations row alone: a
 * record's vendor url is derived from the insertable's own vendors. An
 * insertable with nothing to configure has no configurations row, which the
 * left join answers as empty.
 */
async function getConfigurations(
    db: Db,
    insertableIds: string[]
): Promise<Map<string, InsertableConfiguration>> {
    if (insertableIds.length === 0) {
        return new Map();
    }
    const rows = await db
        .select({
            insertableId: insertables.id,
            vendors: insertables.vendors,
            parameters: configurations.parameters,
            records: configurations.records
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(inArray(insertables.id, insertableIds))
        .all();
    return new Map(
        rows.map((row) => [
            row.insertableId,
            {
                parameters: row.parameters ?? [],
                records: toSearchRecords(row.records ?? [], row.vendors)
            }
        ])
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

        // Named rather than left to the column default, which points at a library this
        // caller may have no row for. The favorite's own key requires the one they chose.
        await db
            .insert(users)
            .values({ id: userId, libraryId })
            .onConflictDoNothing();

        // Counted to see whether there is room for one more, and the highest
        // order taken so the new one lands after it. Not the count: deleting
        // from the middle leaves a gap, and counting would then reuse an order
        // a live favorite still holds.
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
            // Handled rather than internal: the caller can act on this, and
            // removing one is the whole of what it takes.
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
                    ? toSelection(
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
        // Scoped to the owner rather than checked first: a favorite that is not
        // theirs matches nothing, which costs no extra read.
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
                defaultSelection: toSelection(
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

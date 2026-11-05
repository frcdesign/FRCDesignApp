import { desc } from "drizzle-orm";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { getDb, type Db } from "../../db/client";
import { recentInserts } from "../../db/schema";
import {
    getInsertableConfigurations,
    resolveStoredSelection
} from "../configurations/stored-selections";
import type { LibraryId } from "../library/library-id";
import { requireSignInMiddleware } from "../auth/guards";
import { MAX_RECENTS, type RecentInsert, type RecentsData } from "./contract";
import { ofUserInLibrary } from "./store";

export const recentRoutes = getApp();

async function getRecents(
    db: Db,
    userId: string,
    libraryId: LibraryId
): Promise<RecentsData> {
    const rows = await db
        .select()
        .from(recentInserts)
        .where(ofUserInLibrary(userId, libraryId))
        .orderBy(desc(recentInserts.insertedAt))
        .limit(MAX_RECENTS)
        .all();

    const configurationsById = await getInsertableConfigurations(
        db,
        rows.map((row) => row.insertableId)
    );

    const recents = rows.map(
        (row): RecentInsert => ({
            id: row.id,
            insertableId: row.insertableId,
            ...resolveStoredSelection(
                // An insertable with nothing to configure stores an empty one.
                Object.keys(row.selection).length > 0
                    ? row.selection
                    : undefined,
                configurationsById.get(row.insertableId)
            ),
            insertedAt: row.insertedAt.getTime()
        })
    );
    return { recents };
}

/** GET /api/recents/library/:libraryId */
recentRoutes.get(
    "/recents" + libraryRoute(),
    requireSignInMiddleware,
    cacheMiddleware(),
    async (c) => {
        const userId = await c.var.getUserId();
        const db = getDb(c.env.DB);
        return c.json(await getRecents(db, userId, getLibraryParam(c)));
    }
);

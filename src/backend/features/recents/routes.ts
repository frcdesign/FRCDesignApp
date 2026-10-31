import { and, desc, eq } from "drizzle-orm";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import {
    getInsertableParam,
    getLibraryParam,
    insertableRoute,
    libraryRoute
} from "../../lib/route-params";
import { getDb, type Db } from "../../db/client";
import { recentInserts } from "../../db/schema";
import {
    getInsertableConfigurations,
    resolveStoredSelection
} from "../configurations/stored-selections";
import type { LibraryId } from "../library/library-id";
import { requireSignInMiddleware } from "../auth/guards";
import { MAX_RECENTS, type RecentsData } from "./contract";
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

    return {
        recents: rows.map((row) => ({
            insertableId: row.insertableId,
            ...resolveStoredSelection(
                row.selection ?? undefined,
                configurationsById.get(row.insertableId)
            ),
            insertedAt: row.insertedAt.getTime()
        }))
    };
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

/** DELETE /api/recents/library/:libraryId/insertable/:insertableId */
recentRoutes.delete(
    "/recents" + libraryRoute() + insertableRoute(),
    requireSignInMiddleware,
    async (c) => {
        const userId = await c.var.getUserId();
        const db = getDb(c.env.DB);
        await db
            .delete(recentInserts)
            .where(
                and(
                    ofUserInLibrary(userId, getLibraryParam(c)),
                    eq(recentInserts.insertableId, getInsertableParam(c))
                )
            );
        return c.json({ success: true });
    }
);

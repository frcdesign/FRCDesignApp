import { and, desc, eq } from "drizzle-orm";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import {
    getLibraryParam,
    getRecentParam,
    libraryRoute,
    recentRoute
} from "../../lib/route-params";
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
import { sameConfiguration } from "../configurations/selection";

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

    const recents: RecentInsert[] = [];
    // A reload that drops a parameter, or two inserts at once, can leave two rows for one configuration.
    for (const row of rows) {
        const configuration = configurationsById.get(row.insertableId);
        const parameters = configuration?.parameters ?? [];
        const resolved = resolveStoredSelection(
            row.selection ?? undefined,
            configuration
        );
        const shown = recents.some(
            (recent) =>
                recent.insertableId === row.insertableId &&
                sameConfiguration(
                    recent.selection ?? {},
                    resolved.selection ?? {},
                    parameters
                )
        );
        if (shown) {
            continue;
        }
        recents.push({
            id: row.id,
            insertableId: row.insertableId,
            ...resolved,
            insertedAt: row.insertedAt.getTime()
        });
    }
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

/** DELETE /api/recent/:recentId */
recentRoutes.delete(recentRoute(), requireSignInMiddleware, async (c) => {
    const userId = await c.var.getUserId();
    const db = getDb(c.env.DB);
    // Scoped to the owner, so another user's recent matches nothing.
    await db
        .delete(recentInserts)
        .where(
            and(
                eq(recentInserts.id, getRecentParam(c)),
                eq(recentInserts.userId, userId)
            )
        );
    return c.json({ success: true });
});

import { eq } from "drizzle-orm";
import {
    getApp,
    getLibraryParam,
    immutableCacheMiddleware,
    libraryRoute,
    noStoreMiddleware,
    validateCacheVersion
} from "../app";
import { getDb } from "../db";
import { libraries } from "../../shared/schema";
import { getLibraryOut } from "../library-data";
import { LibraryId, type LibraryVersions } from "../../shared/types";
import { HTTPException } from "hono/http-exception";

export const libraryRoutes = getApp();

/**
 * GET /api/library-versions — the cache version of every library, which keys
 * the `?v=` on the routes below. Needs no user, so it stays off the per-user
 * path the rest of the app's boot data sits on.
 */
libraryRoutes.get("/library-versions", noStoreMiddleware, async (c) => {
    const db = getDb(c.env.DB);
    const rows = await db
        .select({ id: libraries.id, cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .all();

    const versions = Object.fromEntries(
        Object.values(LibraryId).map((libraryId) => [
            libraryId,
            rows.find((row) => row.id === libraryId)?.cacheVersion ?? 0
        ])
    ) as LibraryVersions;

    return c.json({ versions });
});

/** GET /api/library-data/library/:libraryId?v=:cacheVersion */
libraryRoutes.get(
    "/library-data" + libraryRoute(),
    validateCacheVersion,
    immutableCacheMiddleware(),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        return c.json(await getLibraryOut(db, libraryId));
    }
);

/** GET /api/search-db/library/:libraryId?v=:cacheVersion */
libraryRoutes.get(
    "/search-db" + libraryRoute(),
    validateCacheVersion,
    immutableCacheMiddleware(),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);

        const library = await db
            .select({ searchDb: libraries.searchDb })
            .from(libraries)
            .where(eq(libraries.id, libraryId))
            .get();

        const searchDb = library?.searchDb;

        if (!searchDb) {
            throw new HTTPException(404, {
                message: "Failed to find searchDb"
            });
        }

        return c.json({ searchDb });
    }
);

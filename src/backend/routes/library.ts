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
import { HTTPException } from "hono/http-exception";

export const libraryRoutes = getApp();

/**
 * GET /api/library-version/library/:libraryId — the version keying the `?v=` on
 * the routes below. Needs no user, so it stays off the per-user boot path.
 */
libraryRoutes.get(
    "/library-version" + libraryRoute(),
    noStoreMiddleware,
    async (c) => {
        const db = getDb(c.env.DB);
        const library = await db
            .select({ cacheVersion: libraries.cacheVersion })
            .from(libraries)
            .where(eq(libraries.id, getLibraryParam(c)))
            .get();

        return c.json({ version: library?.cacheVersion ?? 0 });
    }
);

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

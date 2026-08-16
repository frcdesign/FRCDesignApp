import { eq } from "drizzle-orm";
import {
    getApp,
    getLibraryParam,
    libraryRoute,
    setVersionedCacheHeaders,
    validateCacheVersion
} from "../app";
import { getDb } from "../db";
import { libraries } from "../../shared/schema";
import { getLibraryOut } from "../library-data";
import { HTTPException } from "hono/http-exception";

export const libraryRoutes = getApp();

/** GET /api/library-data/library/:libraryId?v=:cacheVersion */
libraryRoutes.get(
    "/library-data" + libraryRoute(),
    validateCacheVersion,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        // Only once the read succeeded, so a failure isn't cached forever.
        const libraryOut = await getLibraryOut(db, libraryId);
        setVersionedCacheHeaders(c);
        return c.json(libraryOut);
    }
);

/** GET /api/search-db/library/:libraryId?v=:cacheVersion */
libraryRoutes.get(
    "/search-db" + libraryRoute(),
    validateCacheVersion,
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

        setVersionedCacheHeaders(c);
        return c.json({ searchDb });
    }
);

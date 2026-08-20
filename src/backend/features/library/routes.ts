import { eq } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { getDb } from "../../db/client";
import { libraries } from "../../db/schema";
import { getLibraryOut, searchIndexKey } from "./db";

export const libraryRoutes = getApp();

/** GET /api/library-version/library/:libraryId — keys the `?v=` below. */
libraryRoutes.get(
    "/library-version" + libraryRoute(),
    cacheMiddleware(),
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
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        return c.json(await getLibraryOut(db, libraryId));
    }
);

/**
 * GET /api/search-db/library/:libraryId?v=:cacheVersion. Never set
 * `Content-Encoding` here: the runtime would compress it a second time.
 */
libraryRoutes.get(
    "/search-db" + libraryRoute(),
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    async (c) => {
        const libraryId = getLibraryParam(c);

        const object = await c.env.BLOB.get(searchIndexKey(libraryId));
        if (!object) {
            return c.notFound();
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
    }
);

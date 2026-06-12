import { eq } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { requireEditorAccess } from "../access-level-utils";
import { libraries } from "../../shared/schema";
import { getLibraryOut, rebuildSearchDb } from "../library-data";

export const libraryRoutes = getApp();

/** GET /api/library-data/library/:libraryId */
libraryRoutes.get("/library-data" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getLibraryOut(db, libraryId));
});

/** GET /api/search-db/library/:libraryId */
libraryRoutes.get("/search-db" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);

    const existing = await db
        .select({ searchDb: libraries.searchDb })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();

    // Lazily build the index on first request so libraries work without an
    // explicit admin push or a document reload.
    const searchDb =
        existing?.searchDb ?? (await rebuildSearchDb(db, libraryId));
    return c.json({ searchDb });
});

/** POST /api/library-version/library/:libraryId */
libraryRoutes.post("/library-version" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const libraryId = getLibraryParam(c);

    const db = getDb(c.env.DB);

    // Create the library if it doesn't exist and return the cacheVersion
    const lib = await db
        .insert(libraries)
        .values({ id: libraryId })
        .onConflictDoNothing()
        .returning({ cacheVersion: libraries.cacheVersion })
        .get();

    const newVersion = lib.cacheVersion + 1;
    await db
        .insert(libraries)
        .values({ id: libraryId, cacheVersion: newVersion });

    await rebuildSearchDb(db, libraryId);

    return c.json({ newVersion });
});

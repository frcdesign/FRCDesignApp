import { eq } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { requireEditorAccess } from "../access-level-utils";
import { libraries } from "../../shared/schema";
import { getLibraryOut, rebuildSearchDb } from "../library-data";

export const libraryRoutes = getApp();

/** GET /api/library-data/library/:library */
libraryRoutes.get("/library-data" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getLibraryOut(db, library));
});

/** GET /api/search-db/library/:library */
libraryRoutes.get("/search-db" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const db = getDb(c.env.DB);

    const existing = await db
        .select({ searchDb: libraries.searchDb })
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();

    // Lazily build the index on first request so libraries work without an
    // explicit admin push or a document reload.
    const searchDb = existing?.searchDb ?? (await rebuildSearchDb(db, library));
    return c.json({ searchDb });
});

/** POST /api/library-version/library/:library */
libraryRoutes.post("/library-version" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const library = getLibraryParam(c);

    const db = getDb(c.env.DB);

    // Create the library if it doesn't exist and return the cacheVersion
    const lib = await db
        .insert(libraries)
        .values({ id: library })
        .onConflictDoNothing()
        .returning({ cacheVersion: libraries.cacheVersion })
        .get();

    const newVersion = lib.cacheVersion + 1;
    await db
        .insert(libraries)
        .values({ id: library, cacheVersion: newVersion });

    await rebuildSearchDb(db, library);

    return c.json({ newVersion });
});

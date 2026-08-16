import { eq } from "drizzle-orm";
import { getApp, noStoreMiddleware } from "../app";
import { getDb } from "../db";
import { users, libraries } from "../../shared/schema";
import { LibraryId, ContextData, Theme, AccessLevel } from "../../shared/types";
import { env } from "process";

export const userRoutes = getApp();

/** GET /api/context-data */
userRoutes.get("/context-data", noStoreMiddleware, async (c) => {
    const userId = await c.var.getUserId();
    const maxAccessLevel = await c.var.getAccessLevel();
    const db = getDb(c.env.DB);

    let user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
        user = {
            id: userId,
            theme: Theme.SYSTEM,
            libraryId: LibraryId.FRC_DESIGN_LIB
        };
    }

    // Every library's version, not just the saved one: the url picks the library.
    const libs = await db
        .select({ id: libraries.id, cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .all();

    const cacheVersions = Object.fromEntries(
        Object.values(LibraryId).map((libraryId) => [
            libraryId,
            libs.find((lib) => lib.id === libraryId)?.cacheVersion ?? 0
        ])
    ) as Record<LibraryId, number>;

    // Always default to user in dev and the max in production
    const currentAccessLevel =
        env.NODE_ENV === "production" ? AccessLevel.USER : maxAccessLevel;

    return c.json({
        accessData: {
            maxAccessLevel,
            currentAccessLevel
        },
        settings: {
            theme: user.theme,
            libraryId: user.libraryId
        },
        cacheVersions
    } satisfies ContextData);
});

/** POST /api/user-data — update settings */
userRoutes.post("/user-data", async (c) => {
    const userId = await c.var.getUserId();

    const body = await c.req.json<{ theme?: Theme; libraryId?: LibraryId }>();

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    if (Object.keys(body).length > 0) {
        await db.update(users).set(body).where(eq(users.id, userId));
    }

    return c.json({ success: true });
});

import { eq } from "drizzle-orm";
import { getApp } from "../app";
import { getDb } from "../db";
import { users, libraries } from "../../shared/schema";
import { LibraryId, ContextData, Theme } from "../../shared/types";

export const userRoutes = getApp();

/** GET /api/context-data */
userRoutes.get("/context-data", async (c) => {
    const userId = await c.var.getUserId();

    const [maxAccessLevel, db] = await Promise.all([
        c.var.getAccessLevel(),
        Promise.resolve(getDb(c.env.DB))
    ]);

    let user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
        user = {
            id: userId,
            theme: Theme.SYSTEM,
            libraryId: LibraryId.FRC_DESIGN_LIB
        };
    }

    const lib = await db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, user.libraryId))
        .get();

    return c.json({
        accessData: {
            maxAccessLevel,
            currentAccessLevel: maxAccessLevel,
            cacheVersion: lib?.cacheVersion ?? 0
        },
        settings: {
            theme: user.theme,
            libraryId: user.libraryId
        }
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

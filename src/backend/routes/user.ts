import { eq } from "drizzle-orm";
import { getApp, noStoreMiddleware } from "../app";
import { getDb } from "../db";
import { users } from "../../shared/schema";
import {
    AccessLevel,
    DEFAULT_LIBRARY_ID,
    Theme,
    type ContextData,
    type SettingsUpdate
} from "../../shared/types";
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
            libraryId: DEFAULT_LIBRARY_ID
        };
    }

    // Always default to user in dev and the max in production
    const currentAccessLevel =
        env.NODE_ENV === "production" ? AccessLevel.USER : maxAccessLevel;

    return c.json({
        accessData: {
            maxAccessLevel,
            currentAccessLevel
        },
        settings: { theme: user.theme }
    } satisfies ContextData);
});

/** POST /api/user-data — update settings */
userRoutes.post("/user-data", async (c) => {
    const userId = await c.var.getUserId();

    const body = await c.req.json<SettingsUpdate>();

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    if (Object.keys(body).length > 0) {
        await db.update(users).set(body).where(eq(users.id, userId));
    }

    return c.json({ success: true });
});

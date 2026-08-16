import { eq } from "drizzle-orm";
import { cacheMiddleware, getApp } from "../app";
import { getDb } from "../db";
import { users } from "../../shared/schema";
import {
    AccessLevel,
    type AccessData,
    type SettingsUpdate
} from "../../shared/types";
import { isSignedIn, requireSignInMiddleware } from "../sign-in-utils";
import { env } from "process";

export const userRoutes = getApp();

/** GET /api/access-data */
userRoutes.get("/access-data", cacheMiddleware(), async (c) => {
    const maxAccessLevel = await c.var.getAccessLevel();

    // Always default to user in dev and the max in production
    const currentAccessLevel =
        env.NODE_ENV === "production" ? AccessLevel.USER : maxAccessLevel;

    return c.json({
        maxAccessLevel,
        currentAccessLevel,
        signedIn: await isSignedIn(c)
    } satisfies AccessData);
});

/** POST /api/user-data — update settings */
userRoutes.post("/user-data", requireSignInMiddleware, async (c) => {
    const userId = await c.var.getUserId();

    const body = await c.req.json<SettingsUpdate>();

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    if (Object.keys(body).length > 0) {
        await db.update(users).set(body).where(eq(users.id, userId));
    }

    return c.json({ success: true });
});

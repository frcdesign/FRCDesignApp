import { eq } from "drizzle-orm";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import type { AccessData } from "../auth/access-level";
import type { SettingsUpdate } from "./settings";
import { isSignedIn, requireSignInMiddleware } from "../auth/sign-in";

export const userRoutes = getApp();

/** GET /api/access-data */
userRoutes.get("/access-data", cacheMiddleware(), async (c) => {
    return c.json({
        maxAccessLevel: await c.var.getAccessLevel(),
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

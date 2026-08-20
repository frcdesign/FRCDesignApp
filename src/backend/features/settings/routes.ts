import { eq } from "drizzle-orm";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import { requireSignInMiddleware } from "../auth/guards";
import type { SettingsUpdate } from "./settings";

export const settingsRoutes = getApp();

/** POST /api/user-data — update the caller's stored settings */
settingsRoutes.post("/user-data", requireSignInMiddleware, async (c) => {
    const userId = await c.var.getUserId();

    const body = await c.req.json<SettingsUpdate>();

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    if (Object.keys(body).length > 0) {
        await db.update(users).set(body).where(eq(users.id, userId));
    }

    return c.json({ success: true });
});

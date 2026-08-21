import { eq } from "drizzle-orm";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireSignInMiddleware } from "../auth/guards";
import { LibraryId } from "../library/library-id";
import { Theme } from "./settings";

export const settingsRoutes = getApp();

const settingsBody = z.object({
    theme: z.enum(Theme).optional(),
    libraryId: z.enum(LibraryId).optional()
});

/** POST /api/settings — update the caller's stored settings */
settingsRoutes.post(
    "/settings",
    requireSignInMiddleware,
    zValidator("json", settingsBody),
    async (c) => {
        const userId = await c.var.getUserId();
        const body = c.req.valid("json");

        const db = getDb(c.env.DB);

        await db.insert(users).values({ id: userId }).onConflictDoNothing();

        if (Object.keys(body).length > 0) {
            await db.update(users).set(body).where(eq(users.id, userId));
        }

        return c.json({ success: true });
    }
);

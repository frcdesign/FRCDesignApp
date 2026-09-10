import { eq } from "drizzle-orm";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { LibraryId } from "../library/library-id";
import { ensureLibrary } from "../library/db";
import { DEFAULT_SETTINGS, Theme } from "./settings";

export const settingsRoutes = getApp();

const settingsBody = z.object({
    theme: z.enum(Theme).optional(),
    libraryId: z.enum(LibraryId).optional(),
    // Null on leaving a group: the caller resumes in the library itself.
    groupId: z.string().nullable().optional()
});

/** POST /api/settings — update the caller's stored settings */
settingsRoutes.post(
    "/settings",
    requireSignInMiddleware,
    validate("json", settingsBody),
    async (c) => {
        const userId = await c.var.getUserId();
        const body = c.req.valid("json");

        const db = getDb(c.env.DB);

        const libraryId = body.libraryId ?? DEFAULT_SETTINGS.libraryId;

        // The row names its library rather than leaning on the column default,
        // so the library ensured here is the one the foreign key points at.
        await ensureLibrary(db, libraryId);
        await db
            .insert(users)
            .values({ id: userId, libraryId })
            .onConflictDoNothing();

        if (Object.keys(body).length > 0) {
            await db.update(users).set(body).where(eq(users.id, userId));
        }

        return c.json({ success: true });
    }
);

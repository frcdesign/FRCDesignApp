import { eq } from "drizzle-orm";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { DEFAULT_LIBRARY, LibraryId } from "../library/library-id";
import { ensureLibrary } from "../library/db";
import { UtilityTab } from "./app-tab";
import { Theme } from "./settings";

export const settingsRoutes = getApp();

const settingsBody = z.object({
    theme: z.enum(Theme).optional(),
    tabId: z.union([z.enum(LibraryId), z.enum(UtilityTab)]).optional(),
    // Null on leaving a group: the caller resumes in the tab itself.
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

        // The row's dead `library_id` still defaults to this one and still
        // points at `libraries`, so the insert needs it to be there.
        await ensureLibrary(db, DEFAULT_LIBRARY);
        // No tab: a caller who has not chosen one has nothing to record.
        await db.insert(users).values({ id: userId }).onConflictDoNothing();

        if (Object.keys(body).length > 0) {
            await db.update(users).set(body).where(eq(users.id, userId));
        }

        return c.json({ success: true });
    }
);

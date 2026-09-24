import { eq } from "drizzle-orm";
import * as z from "zod";
import { getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { AccessLevel } from "../auth/access-level";
import { requireAdminMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { requestLoads } from "./jobs";
import type { ReloadOut } from "./contract";

export const loadRoutes = getApp();

const reloadBody = z.object({
    /** Reloads documents whose version has not changed, too. */
    force: z.boolean()
});

/**
 * POST /api/reload/library/:libraryId: the documents with a new version or a
 * failed load, or every one when forced. Forcing spends a lot of the Onshape
 * allocation, so it is the owner's alone.
 */
loadRoutes.post(
    "/reload" + libraryRoute(),
    requireAdminMiddleware,
    validate("json", reloadBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { force } = c.req.valid("json");
        if (
            force &&
            (await c.var.getAccessLevel(libraryId)) !== AccessLevel.OWNER
        ) {
            throw forbiddenError("Only the owner can reload all documents");
        }
        const rows = await getDb(c.env.DB)
            .select({ groupId: groups.id, libraryId: groups.libraryId })
            .from(groups)
            .where(eq(groups.libraryId, libraryId));
        const sessionId = getSessionId(c);
        const origin = new URL(c.req.url).origin;
        await requestLoads(
            c.env,
            rows.map((row) => ({
                ...row,
                sessionId,
                forceReload: force,
                origin
            }))
        );
        return c.json({ documents: rows.length } satisfies ReloadOut);
    }
);

import { eq } from "drizzle-orm";
import * as z from "zod";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { requireAdminMiddleware, requireOwner } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { approveHeldReloads, requestReload } from "./jobs";
import type { ApproveVersionsOut, ReloadOut } from "./contract";

export const loadRoutes = getApp();

const reloadBody = z.object({
    /** Reloads documents whose version has not changed, too. */
    forceReload: z.boolean()
});

/**
 * POST /api/reload/library/:libraryId: the documents with a new version or a
 * failed load, or every one when forced. Forcing spends a lot of the Onshape
 * allocation, so it is the owner's alone. It loads any held version too, so
 * their holds are lifted.
 */
loadRoutes.post(
    "/reload" + libraryRoute(),
    requireAdminMiddleware,
    validate("json", reloadBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { forceReload } = c.req.valid("json");
        if (forceReload) {
            await requireOwner(c);
        }
        const rows = await getDb(c.env.DB)
            .select({ groupId: groups.id })
            .from(groups)
            .where(eq(groups.libraryId, libraryId));
        await requestReload(c.env, {
            libraryId,
            groupIds: rows.map((row) => row.groupId),
            sessionId: getSessionId(c),
            forceReload,
            held: false
        });
        await approveHeldReloads(c.env, libraryId);
        return c.json({ documents: rows.length } satisfies ReloadOut);
    }
);

/** POST /api/approve-versions/library/:libraryId */
loadRoutes.post(
    "/approve-versions" + libraryRoute(),
    requireAdminMiddleware,
    async (c) => {
        const documents = await approveHeldReloads(c.env, getLibraryParam(c));
        return c.json({ documents } satisfies ApproveVersionsOut);
    }
);

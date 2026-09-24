import { eq } from "drizzle-orm";
import * as z from "zod";
import { type AppContext, getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { requireAdminMiddleware, requireOwnerMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import type { LibraryId } from "../library/library-id";
import { requestLoads } from "./jobs";
import type { ReloadOut } from "./contract";

export const loadRoutes = getApp();

const reloadBody = z.object({
    /** Reloads documents whose version has not changed, too. */
    force: z.boolean()
});

async function reloadGroups(
    c: AppContext,
    force: boolean,
    libraryId?: LibraryId
): Promise<ReloadOut> {
    const selected = getDb(c.env.DB)
        .select({ groupId: groups.id, libraryId: groups.libraryId })
        .from(groups);
    const rows = await (libraryId
        ? selected.where(eq(groups.libraryId, libraryId))
        : selected);
    const sessionId = getSessionId(c);
    const origin = new URL(c.req.url).origin;
    await requestLoads(
        c.env,
        rows.map((row) => ({ ...row, sessionId, forceReload: force, origin }))
    );
    return { documents: rows.length };
}

/** POST /api/reload/library/:libraryId: every document in one library. */
loadRoutes.post(
    "/reload" + libraryRoute(),
    requireAdminMiddleware,
    validate("json", reloadBody),
    async (c) => {
        const { force } = c.req.valid("json");
        return c.json(await reloadGroups(c, force, getLibraryParam(c)));
    }
);

/** POST /api/reload-all: every document in every library. */
loadRoutes.post(
    "/reload-all",
    requireOwnerMiddleware,
    validate("json", reloadBody),
    async (c) => {
        const { force } = c.req.valid("json");
        return c.json(await reloadGroups(c, force));
    }
);

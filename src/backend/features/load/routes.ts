import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { requireOwnerMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { requestLoads } from "./jobs";

export const loadRoutes = getApp();

/**
 * POST /api/reload-all: starts a forced load per group and returns. For what
 * webhooks can't catch, like a change in how the app reads documents.
 */
loadRoutes.post("/reload-all", requireOwnerMiddleware, async (c) => {
    const sessionId = getSessionId(c);
    const origin = new URL(c.req.url).origin;
    const allGroups = await getDb(c.env.DB)
        .select({ groupId: groups.id, libraryId: groups.libraryId })
        .from(groups);
    await requestLoads(
        c.env,
        allGroups.map((group) => ({
            ...group,
            sessionId,
            forceReload: true,
            origin
        }))
    );
    return c.json({ documents: allGroups.length });
});

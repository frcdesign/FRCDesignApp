import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { requireOwnerMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { requestLoads } from "./jobs";

export const loadRoutes = getApp();

/**
 * POST /api/reload-all — force reloads every document in every library: starts
 * one load per group, all at once, and returns without waiting on any. New versions reload themselves through their webhooks, so
 * this is for what they cannot catch: a change in how the app reads documents,
 * or a document that has never been loaded with a webhook to register.
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

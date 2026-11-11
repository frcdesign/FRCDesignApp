import { z } from "zod";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { type InstancePath } from "../../lib/onshape/path";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { type DesignCheckOut, DesignIssueFix } from "./contract";
import { checkDocument } from "./document";
import { applyFix } from "./fixes";

export const designCheckRoutes = getApp();

/** A workspace: a version can't be edited, so there is nothing to act on. */
const checkQuery = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1)
});

/**
 * GET /api/design-check?documentId=&instanceId= — checks every Part Studio
 * and Assembly of a workspace as it stands. Asked as the caller, so Onshape
 * refuses a document they can't read.
 */
designCheckRoutes.get(
    "/design-check",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", checkQuery),
    async (c) => {
        const workspace: InstancePath = {
            ...c.req.valid("query"),
            instanceType: "w"
        };
        const tabs = await checkDocument(
            c,
            await c.var.getOnshapeApi(),
            workspace
        );
        return c.json({ tabs, checkedAt: Date.now() } satisfies DesignCheckOut);
    }
);

const fixBody = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    elementId: z.string().min(1),
    fix: z.enum(DesignIssueFix),
    assemblyInstanceId: z.string().min(1).optional()
});

/** POST /api/design-check/fix — makes one fix in a workspace, as the caller. */
designCheckRoutes.post(
    "/design-check/fix",
    requireSignInMiddleware,
    validate("json", fixBody),
    async (c) => {
        await applyFix(await c.var.getOnshapeApi(), c.req.valid("json"));
        return c.json({});
    }
);

import { z } from "zod";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { type InstancePath } from "../../lib/onshape/path";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { HttpStatus } from "http-status-ts";
import { getDb } from "../../db/client";
import { handledError } from "../../lib/api-error";
import { canWrite } from "../version-manager/workspace-cache";
import { type DesignCheckOut, DesignIssueFix } from "./contract";
import { markDismissed, setDismissed } from "./dismissals";
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
        const client = await c.var.getOnshapeApi();
        const db = getDb(c.env.DB);
        const [tabs, canDismiss] = await Promise.all([
            checkDocument(c, client, workspace),
            canWrite(c, client, workspace)
        ]);
        return c.json({
            tabs: await markDismissed(db, workspace.documentId, tabs),
            canDismiss,
            checkedAt: Date.now()
        } satisfies DesignCheckOut);
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

const dismissBody = z.object({
    documentId: z.string().min(1),
    elementId: z.string().min(1),
    issueKey: z.string().min(1),
    dismissed: z.boolean()
});

/** POST /api/design-check/dismiss — marks an issue as meant, or puts it back, for everyone. */
designCheckRoutes.post(
    "/design-check/dismiss",
    requireSignInMiddleware,
    validate("json", dismissBody),
    async (c) => {
        const request = c.req.valid("json");
        const client = await c.var.getOnshapeApi();
        if (!(await canWrite(c, client, request))) {
            throw handledError(
                "Dismissing an issue needs edit access to the document.",
                HttpStatus.FORBIDDEN
            );
        }
        await setDismissed(getDb(c.env.DB), await c.var.getUserId(), request);
        return c.json({});
    }
);

import { z } from "zod";
import { cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { ElementType } from "../../lib/onshape/element-type";
import { type ElementPath } from "../../lib/onshape/path";
import { validate } from "../../lib/validate";
import { trackDesignCheck } from "../analytics/tracking";
import { requireSignInMiddleware } from "../auth/guards";
import { getDb } from "../../db/client";
import { checkDesign } from "./checks";
import {
    DESIGN_ISSUE_LEVELS,
    type DesignCheckLevelsOut,
    type DesignCheckOut,
    DesignIssueType
} from "./contract";
import { getLevels, setLevels } from "./levels";
import { readSnapshot } from "./snapshot";

export const designCheckRoutes = getApp();

/** A workspace's tab: a version can't be edited, so there is nothing to act on. */
const checkQuery = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    elementId: z.string().min(1),
    elementType: z.enum(ElementType)
});

/**
 * GET /api/design-check?documentId=&instanceId=&elementId=&elementType= —
 * checks a Part Studio or Assembly as it stands. Asked as the caller, so
 * Onshape refuses a tab they can't read.
 */
designCheckRoutes.get(
    "/design-check",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", checkQuery),
    async (c) => {
        const { elementType, ...ids } = c.req.valid("query");
        const path: ElementPath = { ...ids, instanceType: "w" };
        const snapshot = await readSnapshot(
            await c.var.getOnshapeApi(),
            path,
            elementType
        );
        const { issues, sketchStatusUnknown } = checkDesign(snapshot);
        await trackDesignCheck(c, { elementType, issues });
        return c.json({
            elementType,
            issues,
            sketchStatusUnknown,
            checkedAt: Date.now()
        } satisfies DesignCheckOut);
    }
);

const levelsBody = z.object({
    levels: z.partialRecord(
        z.enum(DesignIssueType),
        z.enum(DESIGN_ISSUE_LEVELS)
    )
});

/** GET /api/design-check/levels — the caller's own, which the page applies. */
designCheckRoutes.get(
    "/design-check/levels",
    requireSignInMiddleware,
    cacheMiddleware(),
    async (c) => {
        const levels = await getLevels(
            getDb(c.env.DB),
            await c.var.getUserId()
        );
        return c.json({ levels } satisfies DesignCheckLevelsOut);
    }
);

/** POST /api/design-check/levels — replaces the caller's; `{}` goes back to FRCDesign's. */
designCheckRoutes.post(
    "/design-check/levels",
    requireSignInMiddleware,
    validate("json", levelsBody),
    async (c) => {
        const { levels } = c.req.valid("json");
        await setLevels(getDb(c.env.DB), await c.var.getUserId(), levels);
        return c.json({ levels } satisfies DesignCheckLevelsOut);
    }
);

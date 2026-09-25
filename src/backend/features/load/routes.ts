import { eq } from "drizzle-orm";
import * as z from "zod";
import { getApp } from "../../lib/context";
import { forbiddenError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups, libraries } from "../../db/schema";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { AccessLevel } from "../auth/access-level";
import { requireAdminMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import { approveHeldLoads, requestLoads } from "./jobs";
import type {
    ApproveVersionsOut,
    ReloadOut,
    VersionApprovalOut
} from "./contract";
import { ensureLibrary } from "../library/db";

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

const versionApprovalBody = z.object({ enabled: z.boolean() });

/** GET /api/version-approval/library/:libraryId */
loadRoutes.get(
    "/version-approval" + libraryRoute(),
    requireAdminMiddleware,
    async (c) => {
        const library = await getDb(c.env.DB)
            .select({ enabled: libraries.approveVersions })
            .from(libraries)
            .where(eq(libraries.id, getLibraryParam(c)))
            .get();
        return c.json({
            enabled: library?.enabled ?? false
        } satisfies VersionApprovalOut);
    }
);

/** POST /api/version-approval/library/:libraryId: turning it off lets held versions through. */
loadRoutes.post(
    "/version-approval" + libraryRoute(),
    requireAdminMiddleware,
    validate("json", versionApprovalBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { enabled } = c.req.valid("json");
        const db = getDb(c.env.DB);
        await ensureLibrary(db, libraryId);
        await db
            .update(libraries)
            .set({ approveVersions: enabled })
            .where(eq(libraries.id, libraryId));
        if (!enabled) {
            await approveHeldLoads(c.env, libraryId);
        }
        return c.json({ enabled } satisfies VersionApprovalOut);
    }
);

/** POST /api/approve-versions/library/:libraryId */
loadRoutes.post(
    "/approve-versions" + libraryRoute(),
    requireAdminMiddleware,
    async (c) => {
        const documents = await approveHeldLoads(c.env, getLibraryParam(c));
        return c.json({ documents } satisfies ApproveVersionsOut);
    }
);

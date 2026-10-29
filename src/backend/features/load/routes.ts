import { eq } from "drizzle-orm";
import * as z from "zod";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { groups, libraries } from "../../db/schema";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import {
    requireAdminMiddleware,
    requireEditorMiddleware,
    requireOwner
} from "../auth/guards";
import { getSessionId } from "../auth/session";
import { requestReload } from "./jobs";
import { approveHeldVersions, getHoldNewVersions } from "./holds";
import { ensureLibrary } from "../library/db";
import type {
    ApproveVersionsOut,
    HoldNewVersionsOut,
    ReloadOut
} from "./contract";

export const loadRoutes = getApp();

const holdNewVersionsBody = z.object({ holdNewVersions: z.boolean() });

const reloadBody = z.object({
    /** Reloads documents whose version has not changed, too. */
    forceReload: z.boolean()
});

/**
 * POST /api/reload/library/:libraryId: the documents with a new version or a
 * failed load, or every one when forced. Editors may, so a held or failed
 * document is never something they can only watch; forcing spends a lot of
 * the Onshape allocation, so it is the owner's alone. It loads any held
 * version too, which releases its hold.
 */
loadRoutes.post(
    "/reload" + libraryRoute(),
    requireEditorMiddleware,
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
            forceReload
        });
        return c.json({ documents: rows.length } satisfies ReloadOut);
    }
);

/** POST /api/approve-versions/library/:libraryId */
loadRoutes.post(
    "/approve-versions" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const documents = await approveHeldVersions(
            c.env,
            getLibraryParam(c),
            getSessionId(c)
        );
        return c.json({ documents } satisfies ApproveVersionsOut);
    }
);

/** GET /api/hold-new-versions/library/:libraryId */
loadRoutes.get(
    "/hold-new-versions" + libraryRoute(),
    requireEditorMiddleware,
    async (c) =>
        c.json({
            holdNewVersions: await getHoldNewVersions(
                getDb(c.env.DB),
                getLibraryParam(c)
            )
        } satisfies HoldNewVersionsOut)
);

/** POST /api/hold-new-versions/library/:libraryId: an admin's choice; versions already held stay held. */
loadRoutes.post(
    "/hold-new-versions" + libraryRoute(),
    requireAdminMiddleware,
    validate("json", holdNewVersionsBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { holdNewVersions } = c.req.valid("json");
        const db = getDb(c.env.DB);
        await ensureLibrary(db, libraryId);
        await db
            .update(libraries)
            .set({ holdNewVersions })
            .where(eq(libraries.id, libraryId));
        return c.json({ holdNewVersions } satisfies HoldNewVersionsOut);
    }
);

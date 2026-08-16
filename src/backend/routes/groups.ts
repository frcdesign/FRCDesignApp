import { and, eq, inArray } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute, setNoStore } from "../app";
import { getDb } from "../db";
import { getSessionId } from "../auth";
import { getDocument } from "../onshape-api/endpoints/documents";
import { requireEditorMiddleware } from "../access-level-utils";
import { type DocumentPath } from "../../shared/onshape-path";
import { group, insertables, libraries, favorites } from "../../shared/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import {
    isAnyJobRunning,
    isReloadRunning,
    trackJob
} from "../load/job-tracker";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

export const groupRoutes = getApp();

const reloadGroupsQuery = z.object({
    forceReload: z.stringbool().default(false)
});

/** POST /api/reload-groups/library/:libraryId?forceReload=true */
groupRoutes.post(
    "/reload-groups" + libraryRoute(),
    requireEditorMiddleware,
    zValidator("query", reloadGroupsQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { forceReload } = c.req.valid("query");
        const sessionId = getSessionId(c);

        // Only one reload per library at a time. Racy under a sub-second
        // double-trigger (KV has no compare-and-swap), which is fine here.
        if (await isReloadRunning(c.env, libraryId)) {
            return c.json({ status: "already-running" });
        }

        const db = getDb(c.env.DB);
        await db
            .insert(libraries)
            .values({ id: libraryId })
            .onConflictDoNothing();

        // The workflow owns the per-group version check — unchanged documents
        // are skipped inside it (unless forceReload).
        const instance = await c.env.LOAD_LIBRARY_WORKFLOW.create({
            params: { libraryId, sessionId, forceReload }
        });
        await trackJob(c.env, libraryId, "reload", instance.id);

        return c.json({ status: "triggered" });
    }
);

/** GET /api/job-status/library/:libraryId */
groupRoutes.get(
    "/job-status" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const running = await isAnyJobRunning(c.env, getLibraryParam(c));
        setNoStore(c);
        return c.json({ running });
    }
);

/** POST /api/set-element-visibility/library/:libraryId */
groupRoutes.post(
    "/set-element-visibility" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const body = await c.req.json<{
            insertableIds: string[];
            isVisible: boolean;
        }>();

        const db = getDb(c.env.DB);

        if (!body.isVisible) {
            await db
                .delete(favorites)
                .where(
                    and(
                        eq(favorites.libraryId, libraryId),
                        inArray(favorites.insertableId, body.insertableIds)
                    )
                );
        }

        await db
            .update(insertables)
            .set({ isVisible: body.isVisible })
            .where(
                and(
                    eq(insertables.libraryId, libraryId),
                    inArray(insertables.id, body.insertableIds)
                )
            );

        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/sort-group-alphabetically/library/:libraryId */
groupRoutes.post(
    "/sort-group-alphabetically" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const body = await c.req.json<{
            groupId: string;
            sortAlphabetically: boolean;
        }>();

        const db = getDb(c.env.DB);
        await db
            .update(group)
            .set({ sortAlphabetically: body.sortAlphabetically })
            .where(
                and(eq(group.id, body.groupId), eq(group.libraryId, libraryId))
            );

        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/group-order/library/:libraryId */
groupRoutes.post(
    "/group-order" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const body = await c.req.json<{ groupOrder: string[] }>();

        const db = getDb(c.env.DB);
        await Promise.all(
            body.groupOrder.map((id, i) =>
                db
                    .update(group)
                    .set({ sortOrder: i })
                    .where(
                        and(eq(group.id, id), eq(group.libraryId, libraryId))
                    )
            )
        );

        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/group/library/:libraryId — add a new group from an Onshape document */
groupRoutes.post(
    "/group" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const libraryId = getLibraryParam(c);
        const body = await c.req.json<{
            newDocumentId: string;
            selectedGroupId?: string;
        }>();
        const sessionId = getSessionId(c);

        const documentPath: DocumentPath = { documentId: body.newDocumentId };

        let documentName: string;
        try {
            documentName = (await getDocument(onshapeApi, documentPath)).name;
        } catch {
            return c.json(
                {
                    type: "handled",
                    message: "Failed to find the specified document.",
                    isError: true
                },
                422
            );
        }

        const db = getDb(c.env.DB);

        const existingGroup = await db
            .select({ id: group.id })
            .from(group)
            .where(
                and(
                    eq(group.documentId, body.newDocumentId),
                    eq(group.libraryId, libraryId)
                )
            )
            .get();

        if (existingGroup) {
            return c.json(
                {
                    type: "handled",
                    message: "Document has already been added to library.",
                    isError: true
                },
                422
            );
        }

        const groupId = crypto.randomUUID();

        const instance = await c.env.ADD_GROUP_WORKFLOW.create({
            params: {
                groupId,
                documentId: body.newDocumentId,
                libraryId,
                sessionId,
                selectedGroupId: body.selectedGroupId
            }
        });
        await trackJob(c.env, libraryId, "add-group", instance.id);

        return c.json({ name: documentName });
    }
);

/** DELETE /api/group/library/:libraryId?groupId=X */
groupRoutes.delete(
    "/group" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const groupId = c.req.query("groupId");
        if (!groupId) return c.json({ error: "groupId required" }, 400);

        const db = getDb(c.env.DB);

        // Cascade deletes insertables → favorites, and configurations automatically
        await db
            .delete(group)
            .where(and(eq(group.id, groupId), eq(group.libraryId, libraryId)));

        await bumpLibraryVersion(db, libraryId);
        await rebuildSearchDb(db, libraryId);
        return c.json({ success: true });
    }
);

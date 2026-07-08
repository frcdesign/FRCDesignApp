import { and, eq, inArray } from "drizzle-orm";
import {
    getApp,
    getLibraryParam,
    libraryRoute,
    type AppBindings
} from "../app";
import { getDb } from "../db";
import { getSessionId } from "../auth";
import { getDocument } from "../onshape-api/endpoints/documents";
import { requireEditorMiddleware } from "../access-level-utils";
import { type DocumentPath } from "../../shared/onshape-path";
import { group, insertables, libraries, favorites } from "../../shared/schema";
import { type OnshapeApi } from "../onshape-api/onshape-api";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import { type LibraryId } from "../../shared/types";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

export const groupRoutes = getApp();

export async function reloadGroup(
    api: OnshapeApi,
    workflow: AppBindings["LOAD_DOCUMENT_WORKFLOW"],
    group: { id: string; documentId: string; versionId: string },
    libraryId: LibraryId,
    sessionId: string,
    forceReload: boolean
): Promise<boolean> {
    try {
        const doc = await getDocument(api, { documentId: group.documentId });
        if (!forceReload && doc.recentVersion.id === group.versionId) {
            return false;
        }
        await workflow.create({
            params: {
                groupId: group.id,
                documentId: group.documentId,
                libraryId,
                sessionId,
                isNew: false,
                forceReload
            }
        });
        return true;
    } catch {
        return false;
    }
}

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
        const onshapeApi = await c.var.getOnshapeApi();

        const db = getDb(c.env.DB);
        await db
            .insert(libraries)
            .values({ id: libraryId })
            .onConflictDoNothing();

        const groupRows = await db
            .select({
                id: group.id,
                documentId: group.documentId,
                versionId: group.versionId
            })
            .from(group)
            .where(eq(group.libraryId, libraryId))
            .all();

        const results = await Promise.all(
            groupRows.map((group) =>
                reloadGroup(
                    onshapeApi,
                    c.env.LOAD_DOCUMENT_WORKFLOW,
                    group,
                    libraryId,
                    sessionId,
                    forceReload
                )
            )
        );

        return c.json({
            status: "triggered",
            count: results.filter(Boolean).length
        });
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

        await c.env.LOAD_DOCUMENT_WORKFLOW.create({
            params: {
                groupId,
                documentId: body.newDocumentId,
                libraryId,
                sessionId,
                isNew: true,
                selectedGroupId: body.selectedGroupId
            }
        });

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

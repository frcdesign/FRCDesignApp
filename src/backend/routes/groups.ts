import { and, asc, eq, inArray } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { getSessionId } from "../auth";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getDocument } from "../onshape-api/endpoints/documents";
import { requireEditorMiddleware } from "../access-level-utils";
import { type DocumentPath } from "../../shared/onshape-path";
import { libraries, groups, insertables, favorites } from "../../shared/schema";
import type { LoadDocumentParams } from "../parse/load-document";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";

export const groupRoutes = getApp();

/** POST /api/reload-groups/library/:libraryId?forceReload=true */
groupRoutes.post(
    "/reload-groups" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const forceReload = c.req.query("forceReload") === "true";

        const sessionId = getSessionId(c);

        const db = getDb(c.env.DB);
        await db
            .insert(libraries)
            .values({ id: libraryId })
            .onConflictDoNothing();

        // Each group re-syncs from its Onshape document.
        const groupRows = await db
            .select({ documentId: groups.documentId })
            .from(groups)
            .where(eq(groups.libraryId, libraryId))
            .orderBy(asc(groups.sortOrder))
            .all();

        const instances = await Promise.all(
            groupRows.map(({ documentId }) => {
                const params: LoadDocumentParams = {
                    documentId,
                    libraryId,
                    sessionId,
                    forceReload
                };
                return c.env.LOAD_DOCUMENT_WORKFLOW.create({ params });
            })
        );

        return c.json({ status: "triggered", count: instances.length });
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
            .update(groups)
            .set({ sortAlphabetically: body.sortAlphabetically })
            .where(
                and(
                    eq(groups.id, body.groupId),
                    eq(groups.libraryId, libraryId)
                )
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
                    .update(groups)
                    .set({ sortOrder: i })
                    .where(
                        and(eq(groups.id, id), eq(groups.libraryId, libraryId))
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
            const doc = await getDocument(onshapeApi, documentPath);
            documentName = doc.name;
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

        try {
            await getLatestVersion(onshapeApi, documentPath);
        } catch {
            return c.json(
                {
                    type: "handled",
                    message: "Failed to find a document version to use.",
                    isError: true
                },
                422
            );
        }

        const db = getDb(c.env.DB);

        await db
            .insert(libraries)
            .values({ id: libraryId })
            .onConflictDoNothing();

        const existingGroup = await db
            .select({ id: groups.id })
            .from(groups)
            .where(
                and(
                    eq(groups.documentId, body.newDocumentId),
                    eq(groups.libraryId, libraryId)
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

        const params: LoadDocumentParams = {
            documentId: body.newDocumentId,
            libraryId,
            sessionId,
            selectedGroupId: body.selectedGroupId
        };
        await c.env.LOAD_DOCUMENT_WORKFLOW.create({ params });

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
            .delete(groups)
            .where(
                and(eq(groups.id, groupId), eq(groups.libraryId, libraryId))
            );

        await bumpLibraryVersion(db, libraryId);
        await rebuildSearchDb(db, libraryId);
        return c.json({ success: true });
    }
);

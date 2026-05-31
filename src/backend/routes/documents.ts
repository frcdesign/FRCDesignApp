import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { type AppBindings, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { getSessionId } from "../auth";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getDocument } from "../onshape-api/endpoints/documents";
import { requireEditorAccess } from "../access-level-utils";
import { type DocumentPath } from "../../shared/path";
import {
    libraries,
    documents,
    insertables,
    favorites
} from "../../shared/schema";
import type { LoadDocumentParams } from "../parse/load-document";

export const documentRoutes = new Hono<{ Bindings: AppBindings }>();

/** POST /api/reload-documents/library/:library?forceReload=true */
documentRoutes.post("/reload-documents" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const library = getLibraryParam(c);
    const forceReload = c.req.query("forceReload") === "true";

    const sessionId = getSessionId(c);

    const db = getDb(c.env.DB);
    await db.insert(libraries).values({ id: library }).onConflictDoNothing();

    const lib = await db
        .select({ documentOrder: libraries.documentOrder })
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();

    const documentOrder: string[] = lib?.documentOrder ?? [];

    const instances = await Promise.all(
        documentOrder.map((documentId) => {
            const params: LoadDocumentParams = {
                documentId,
                libraryId: library,
                sessionId,
                forceReload
            };
            return c.env.LOAD_DOCUMENT_WORKFLOW.create({ params });
        })
    );

    return c.json({ status: "triggered", count: instances.length });
});

/** POST /api/set-element-visibility/library/:library */
documentRoutes.post("/set-element-visibility" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const library = getLibraryParam(c);
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
                    eq(favorites.libraryId, library),
                    inArray(favorites.insertableId, body.insertableIds)
                )
            );
    }

    await db
        .update(insertables)
        .set({ isVisible: body.isVisible })
        .where(
            and(
                eq(insertables.libraryId, library),
                inArray(insertables.id, body.insertableIds)
            )
        );

    return c.json({ success: true });
});

/** POST /api/sort-document-alphabetically/library/:library */
documentRoutes.post(
    "/sort-document-alphabetically" + libraryRoute(),
    async (c) => {
        await requireEditorAccess(c);
        const library = getLibraryParam(c);
        const body = await c.req.json<{
            documentId: string;
            sortAlphabetically: boolean;
        }>();

        const db = getDb(c.env.DB);
        await db
            .update(documents)
            .set({ sortAlphabetically: body.sortAlphabetically })
            .where(
                and(
                    eq(documents.id, body.documentId),
                    eq(documents.libraryId, library)
                )
            );

        return c.json({ success: true });
    }
);

/** POST /api/document-order/library/:library */
documentRoutes.post("/document-order" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const library = getLibraryParam(c);
    const body = await c.req.json<{ documentOrder: string[] }>();

    const db = getDb(c.env.DB);
    await db
        .update(libraries)
        .set({ documentOrder: body.documentOrder })
        .where(eq(libraries.id, library));

    return c.json({ success: true });
});

/** POST /api/document/library/:library — add a new document */
documentRoutes.post("/document" + libraryRoute(), async (c) => {
    const onshapeApi = await requireEditorAccess(c);
    const library = getLibraryParam(c);
    const body = await c.req.json<{
        newDocumentId: string;
        selectedDocumentId?: string;
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

    await db.insert(libraries).values({ id: library }).onConflictDoNothing();
    const lib = await db
        .select({ documentOrder: libraries.documentOrder })
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();
    if ((lib?.documentOrder ?? []).includes(body.newDocumentId)) {
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
        libraryId: library,
        sessionId,
        selectedDocumentId: body.selectedDocumentId
    };
    await c.env.LOAD_DOCUMENT_WORKFLOW.create({ params });

    return c.json({ name: documentName });
});

/** DELETE /api/document/library/:library?documentId=X */
documentRoutes.delete("/document" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const library = getLibraryParam(c);
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId required" }, 400);

    const db = getDb(c.env.DB);

    // Cascade deletes insertables → favorites, and configurations automatically
    await db
        .delete(documents)
        .where(
            and(eq(documents.id, documentId), eq(documents.libraryId, library))
        );

    const lib = await db
        .select({ documentOrder: libraries.documentOrder })
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();

    const documentOrder: string[] = lib?.documentOrder ?? [];
    const newOrder = documentOrder.filter((id) => id !== documentId);

    await db
        .update(libraries)
        .set({ documentOrder: newOrder })
        .where(eq(libraries.id, library));

    return c.json({ success: true });
});

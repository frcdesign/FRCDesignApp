import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { AppContext, type AppBindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi, getSessionId } from "../auth";
import { getAccessLevel } from "../onshape-api/endpoints/users";
import { getLatestVersion } from "../onshape-api/endpoints/versions";
import { getDocument } from "../onshape-api/endpoints/documents";
import { type DocumentPath } from "../../shared/path";
import {
    libraries,
    documents,
    insertables,
    favorites
} from "../../shared/schema";
import { Library } from "../../shared/types";
import { hasEditorAccess } from "../../shared/types";
import { env } from "cloudflare:workers";
import type { LoadDocumentParams } from "../parse/load-document";

async function requireEditorAccess(
    c: AppContext
): Promise<Awaited<ReturnType<typeof getOnshapeApi>>> {
    const onshapeApi = await getOnshapeApi(c);
    const adminTeam = (env as any).ADMIN_TEAM;
    if (!adminTeam) throw new Error("ADMIN_TEAM must be configured");

    const level = await getAccessLevel(onshapeApi, adminTeam);
    if (!hasEditorAccess(level)) {
        throw new Error("Insufficient permissions");
    }
    return onshapeApi;
}

export const documentRoutes = new Hono<{ Bindings: AppBindings }>();

/** POST /api/reload-documents/:library?forceReload=true */
documentRoutes.post("/reload-documents/:library", async (c) => {
    await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
    const forceReload = c.req.query("forceReload") === "true";
    const sessionId = getSessionId(c);
    if (!sessionId) {
        return c.json({ error: "No session found" }, 401);
    }

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

/** POST /api/set-element-visibility/:library */
documentRoutes.post("/set-element-visibility/:library", async (c) => {
    await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
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

/** POST /api/sort-document-alphabetically/:library */
documentRoutes.post("/sort-document-alphabetically/:library", async (c) => {
    await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
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
});

/** POST /api/document-order/:library */
documentRoutes.post("/document-order/:library", async (c) => {
    await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
    const body = await c.req.json<{ documentOrder: string[] }>();

    const db = getDb(c.env.DB);
    await db
        .update(libraries)
        .set({ documentOrder: body.documentOrder })
        .where(eq(libraries.id, library));

    return c.json({ success: true });
});

/** POST /api/document/:library — add a new document */
documentRoutes.post("/document/:library", async (c) => {
    const onshapeApi = await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
    const body = await c.req.json<{
        newDocumentId: string;
        selectedDocumentId?: string;
    }>();
    const sessionId = getSessionId(c);
    if (!sessionId) {
        return c.json({ error: "No session found" }, 401);
    }

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

    const documentOrder: string[] = lib?.documentOrder ?? [];

    if (documentOrder.includes(body.newDocumentId)) {
        return c.json(
            {
                type: "handled",
                message: "Document has already been added to library.",
                isError: true
            },
            422
        );
    }

    if (body.selectedDocumentId) {
        const selectedIndex = documentOrder.indexOf(body.selectedDocumentId);
        if (selectedIndex === -1) {
            return c.json(
                {
                    type: "handled",
                    message: "Selected document not found in library.",
                    isError: true
                },
                422
            );
        }
        documentOrder.splice(selectedIndex + 1, 0, body.newDocumentId);
    } else {
        documentOrder.push(body.newDocumentId);
    }

    await db
        .update(libraries)
        .set({ documentOrder })
        .where(eq(libraries.id, library));

    const params: LoadDocumentParams = {
        documentId: body.newDocumentId,
        libraryId: library,
        sessionId
    };
    await c.env.LOAD_DOCUMENT_WORKFLOW.create({ params });

    return c.json({ name: documentName });
});

/** DELETE /api/document/:library?documentId=X */
documentRoutes.delete("/document/:library", async (c) => {
    await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
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

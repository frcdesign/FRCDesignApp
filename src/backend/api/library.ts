import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { type AppBindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getAccessLevel, getUserId } from "../onshape-api/endpoints/users";
import {
    libraries,
    documents,
    insertables,
    configurations,
    favorites,
    users
} from "../../shared/schema";
import {
    Library,
    ElementType,
    ThumbnailUrls
} from "../../frontend/api-utils/client-models";
import { Vendor } from "../../shared/types";
import { HTTPException } from "hono/http-exception";

export interface DocumentPathOut {
    documentId: string;
    instanceId: string;
    instanceType: "v";
}

export interface ElementPathOut extends DocumentPathOut {
    elementId: string;
}

export interface ElementOut {
    id: string;
    elementId: string;
    documentId: string;
    path: ElementPathOut;
    name: string;
    microversionId: string;
    versionName: string;
    versionCreatedAt: string;
    isVisible: boolean;
    isOpenComposite: boolean;
    supportsFasten: boolean;
    elementType: ElementType;
    thumbnailUrls: ThumbnailUrls;
    configurationId?: string;
    vendors: Vendor[];
}

export interface DocumentOut {
    id: string;
    path: DocumentPathOut;
    name: string;
    sortAlphabetically: boolean;
    thumbnailUrls: ThumbnailUrls;
    insertableOrder: string[];
}

export interface LibraryOut {
    documentOrder: string[];
    documents: Record<string, DocumentOut>;
    insertables: Record<string, ElementOut>;
}

async function getAppAccessLevel(
    c: { env: AppBindings },
    onshapeApi: Awaited<ReturnType<typeof getOnshapeApi>>
): Promise<string> {
    const adminTeam = (c.env as any).ADMIN_TEAM;
    if (!adminTeam) throw new Error("ADMIN_TEAM must be configured");
    return getAccessLevel(onshapeApi, adminTeam);
}

async function requireEditorAccess(c: { env: AppBindings }): Promise<void> {
    const onshapeApi = await getOnshapeApi(c as any);
    const level = await getAppAccessLevel(c, onshapeApi);
    if (level !== "editor" && level !== "admin")
        throw new Error("Insufficient permissions");
}

async function getLibraryOut(
    db: ReturnType<typeof getDb>,
    library: Library
): Promise<LibraryOut> {
    const lib = await db
        .select()
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();
    if (!lib) return { documentOrder: [], documents: {}, insertables: {} };

    const documentOrder: string[] = lib.documentOrder;

    const [allDocuments, allInsertables, allConfigurations] = await Promise.all(
        [
            db
                .select()
                .from(documents)
                .where(eq(documents.libraryId, library))
                .all(),
            db
                .select()
                .from(insertables)
                .where(eq(insertables.libraryId, library))
                .all(),
            db
                .select({
                    id: configurations.id,
                    elementId: configurations.elementId,
                    documentId: configurations.documentId
                })
                .from(configurations)
                .where(eq(configurations.libraryId, library))
                .all()
        ]
    );

    // Map (elementId:documentId) → configuration UUID for quick lookup
    const configMap = new Map(
        allConfigurations.map((c) => [`${c.elementId}:${c.documentId}`, c.id])
    );

    // Map (elementId:documentId) → insertable UUID to convert stored element IDs to UUIDs
    const insertableUUIDMap = new Map(
        allInsertables.map((ins) => [
            `${ins.elementId}:${ins.documentId}`,
            ins.id
        ])
    );

    const documentsOut: Record<string, DocumentOut> = {};
    for (const doc of allDocuments) {
        const storedOrder: string[] = doc.insertableOrder;
        const insertableOrder = storedOrder
            .map((eid) => insertableUUIDMap.get(`${eid}:${doc.id}`))
            .filter((id): id is string => id !== undefined);
        documentsOut[doc.id] = {
            id: doc.id,
            path: {
                documentId: doc.id,
                instanceId: doc.instanceId,
                instanceType: "v"
            },
            name: doc.name,
            sortAlphabetically: doc.sortAlphabetically,
            thumbnailUrls: doc.thumbnailUrls as ThumbnailUrls,
            insertableOrder
        };
    }

    const insertablesOut: Record<string, ElementOut> = {};
    for (const ins of allInsertables) {
        const doc = allDocuments.find((d) => d.id === ins.documentId);
        if (!doc) continue;
        const configId = configMap.get(`${ins.elementId}:${ins.documentId}`);
        insertablesOut[ins.id] = {
            id: ins.id,
            elementId: ins.elementId,
            documentId: ins.documentId,
            path: {
                documentId: ins.documentId,
                instanceId: doc.instanceId,
                instanceType: "v",
                elementId: ins.elementId
            },
            name: ins.name,
            microversionId: ins.microversionId,
            versionName: ins.versionName,
            versionCreatedAt: ins.versionCreatedAt,
            isVisible: ins.isVisible,
            isOpenComposite: ins.isOpenComposite,
            supportsFasten: ins.supportsFasten,
            elementType: ins.elementType as ElementType,
            thumbnailUrls: ins.thumbnailUrls as ThumbnailUrls,
            configurationId: configId,
            vendors: ins.vendors as Vendor[]
        };
    }

    return {
        documentOrder,
        documents: documentsOut,
        insertables: insertablesOut
    };
}

export const libraryRoutes = new Hono<{ Bindings: AppBindings }>();

/** GET /api/library-data?library=X */
libraryRoutes.get("/library-data", async (c) => {
    const library = c.req.query("library") as Library;
    if (!library) {
        throw new HTTPException(400, {
            message: "Library is required"
        });
    }

    const db = getDb(c.env.DB);
    return c.json(await getLibraryOut(db, library));
});

/** GET /api/search-db?library=X */
libraryRoutes.get("/search-db", async (c) => {
    const library = c.req.query("library") as Library;
    if (!library) return c.json({ error: "library required" }, 400);

    const raw = await c.env.KV.get(`searchdb:${library}`);
    return c.json({ searchDb: raw });
});

/** POST /api/library-version/:library */
libraryRoutes.post("/library-version/:library", async (c) => {
    await requireEditorAccess(c);
    const library = c.req.param("library") as Library;
    const body = await c.req.json<{ searchDb: string }>();

    const db = getDb(c.env.DB);

    const lib = await db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();

    const newVersion = (lib?.cacheVersion ?? 0) + 1;

    await db
        .insert(libraries)
        .values({ id: library, cacheVersion: newVersion })
        .onConflictDoUpdate({
            target: libraries.id,
            set: { cacheVersion: newVersion }
        });

    await c.env.KV.put(`searchdb:${library}`, body.searchDb);

    return c.json({ newVersion });
});

/** POST /api/favorites/:library */
libraryRoutes.post("/favorites/:library", async (c) => {
    const library = c.req.param("library") as Library;
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const insertableId = c.req.query("insertableId");
    if (!insertableId) return c.json({ error: "insertableId required" }, 400);

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    const existingCount = await db
        .select({ sortOrder: favorites.sortOrder })
        .from(favorites)
        .where(
            and(eq(favorites.userId, userId), eq(favorites.libraryId, library))
        )
        .all();

    const nextOrder = existingCount.length;

    await db
        .insert(favorites)
        .values({
            userId,
            libraryId: library,
            insertableId,
            sortOrder: nextOrder
        })
        .onConflictDoNothing();

    return c.json({ success: true });
});

/** DELETE /api/favorites/:library */
libraryRoutes.delete("/favorites/:library", async (c) => {
    const library = c.req.param("library") as Library;
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const insertableId = c.req.query("insertableId");
    if (!insertableId) return c.json({ error: "insertableId required" }, 400);

    const db = getDb(c.env.DB);
    await db
        .delete(favorites)
        .where(
            and(
                eq(favorites.userId, userId),
                eq(favorites.libraryId, library),
                eq(favorites.insertableId, insertableId)
            )
        );

    return c.json({ success: true });
});

/** POST /api/favorite-order/:library */
libraryRoutes.post("/favorite-order/:library", async (c) => {
    const library = c.req.param("library") as Library;
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const body = await c.req.json<{ favoriteOrder: string[] }>();

    const db = getDb(c.env.DB);
    await Promise.all(
        body.favoriteOrder.map((insertableId, i) =>
            db
                .update(favorites)
                .set({ sortOrder: i })
                .where(
                    and(
                        eq(favorites.userId, userId),
                        eq(favorites.libraryId, library),
                        eq(favorites.insertableId, insertableId)
                    )
                )
        )
    );

    return c.json({ success: true });
});

/** POST /api/default-configuration/:library */
libraryRoutes.post("/default-configuration/:library", async (c) => {
    const library = c.req.param("library") as Library;
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const body = await c.req.json<{
        insertableId: string;
        defaultConfiguration: Record<string, string>;
    }>();

    const db = getDb(c.env.DB);
    await db
        .update(favorites)
        .set({
            defaultConfiguration: body.defaultConfiguration
        })
        .where(
            and(
                eq(favorites.userId, userId),
                eq(favorites.libraryId, library),
                eq(favorites.insertableId, body.insertableId)
            )
        );

    return c.json({ success: true });
});

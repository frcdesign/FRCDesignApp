import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { type AppBindings, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getUserId } from "../onshape-api/endpoints/users";
import { requireEditorAccess } from "../access-level-utils";
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
    ThumbnailUrls,
    ElementType,
    Vendor
} from "../../shared/types";
import {
    InsertableOut,
    LibraryOut,
    Insertables,
    Documents
} from "../../shared/api-models";

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

    const documentsOut: Documents = {};
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

    const insertablesOut: Insertables = {};
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
        } satisfies InsertableOut;
    }

    return {
        documentOrder,
        documents: documentsOut,
        insertables: insertablesOut
    };
}

export const libraryRoutes = new Hono<{ Bindings: AppBindings }>();

/** GET /api/library-data/library/:library */
libraryRoutes.get("/library-data" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getLibraryOut(db, library));
});

/** GET /api/search-db/library/:library */
libraryRoutes.get("/search-db" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
    const raw = await c.env.KV.get(`searchdb:${library}`);
    return c.json({ searchDb: raw });
});

/** POST /api/library-version/library/:library */
libraryRoutes.post("/library-version" + libraryRoute(), async (c) => {
    await requireEditorAccess(c);
    const library = getLibraryParam(c);
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

/** POST /api/favorites/library/:library */
libraryRoutes.post("/favorites" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
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

/** DELETE /api/favorites/library/:library */
libraryRoutes.delete("/favorites" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
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

/** POST /api/favorite-order/library/:library */
libraryRoutes.post("/favorite-order" + libraryRoute(), async (c) => {
    const library = getLibraryParam(c);
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

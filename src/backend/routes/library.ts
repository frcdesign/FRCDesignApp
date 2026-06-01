import { asc, eq } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { requireEditorAccess } from "../access-level-utils";
import {
    libraries,
    documents,
    insertables,
    configurations
} from "../../shared/schema";
import { Library, ThumbnailUrls, Vendor } from "../../shared/types";
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
    const allDocuments = await db
        .select()
        .from(documents)
        .where(eq(documents.libraryId, library))
        .orderBy(asc(documents.sortOrder))
        .all();

    if (allDocuments.length === 0) {
        return { documentOrder: [], documents: {}, insertables: {} };
    }

    const documentOrder = allDocuments.map((d) => d.id);

    const [allInsertables, allConfigurations] = await Promise.all([
        db
            .select()
            .from(insertables)
            .where(eq(insertables.libraryId, library))
            .orderBy(asc(insertables.sortOrder))
            .all(),
        db.select({ id: configurations.id }).from(configurations).all()
    ]);

    const configSet = new Set(allConfigurations.map((c) => c.id));

    const documentsOut: Documents = {};
    for (const doc of allDocuments) {
        const docInsertables = allInsertables.filter(
            (ins) => ins.documentId === doc.id
        );
        if (doc.sortAlphabetically) {
            docInsertables.sort((a, b) => a.name.localeCompare(b.name));
        }
        const insertableOrder = docInsertables.map((ins) => ins.id);
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
        insertablesOut[ins.id] = {
            id: ins.id,
            elementId: ins.elementId,
            documentId: ins.documentId,
            instanceId: ins.instanceId,
            path: {
                documentId: ins.documentId,
                instanceId: ins.instanceId,
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
            elementType: ins.elementType,
            thumbnailUrls: ins.thumbnailUrls as ThumbnailUrls,
            configurationId: configSet.has(ins.id) ? ins.id : undefined,
            vendors: ins.vendors as Vendor[]
        } satisfies InsertableOut;
    }

    return {
        documentOrder,
        documents: documentsOut,
        insertables: insertablesOut
    };
}

export const libraryRoutes = getApp();

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

    // Create the library if it doesn't exist and return the cacheVersion
    const lib = await db
        .insert(libraries)
        .values({ id: library })
        .onConflictDoNothing()
        .returning({ cacheVersion: libraries.cacheVersion })
        .get();

    const newVersion = lib.cacheVersion + 1;
    await db
        .insert(libraries)
        .values({ id: library, cacheVersion: newVersion });

    await c.env.KV.put(`searchdb:${library}`, body.searchDb);

    return c.json({ newVersion });
});

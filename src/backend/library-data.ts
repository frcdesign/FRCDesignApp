import { asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
    libraries,
    documents,
    insertables,
    configurations
} from "../shared/schema";
import { Library } from "../shared/types";
import {
    InsertableOut,
    LibraryOut,
    Insertables,
    Documents
} from "../shared/api-models";
import { buildSearchDb } from "../shared/search";

/**
 * Assembles the full `LibraryOut` (documents + insertables, in sort order) for a
 * library from D1.
 */
export async function getLibraryOut(
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
            thumbnailUrls: doc.thumbnailUrls!,
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
            thumbnailUrls: ins.thumbnailUrls!,
            configurationId: configSet.has(ins.id) ? ins.id : undefined,
            vendors: ins.vendors
        } satisfies InsertableOut;
    }

    return {
        documentOrder,
        documents: documentsOut,
        insertables: insertablesOut
    };
}

/**
 * Rebuilds the serialized MiniSearch index for a library from its current
 * documents/insertables and stores it on the `libraries` row in D1.
 */
export async function rebuildSearchDb(
    db: ReturnType<typeof getDb>,
    library: Library
): Promise<string> {
    const libraryData = await getLibraryOut(db, library);
    const searchDb = JSON.stringify(buildSearchDb(libraryData));
    await db
        .insert(libraries)
        .values({ id: library, searchDb })
        .onConflictDoUpdate({ target: libraries.id, set: { searchDb } });
    return searchDb;
}

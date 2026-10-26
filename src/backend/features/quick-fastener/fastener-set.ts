/** The fasteners a library loaded, read back for Quick fastener. */
import { and, eq, like } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import { getGeneratedSet } from "../generated-parts/store";
import { LibraryId } from "../library/library-id";
import { catalogSchema } from "./catalog";
import {
    FASTENERS,
    FastenerKind,
    type FastenerSet,
    type FastenerStudio
} from "./studios";

/** The library Quick fastener's FRC fasteners are loaded into. */
export const FASTENER_LIBRARY = LibraryId.FRC_DESIGN_LIB;

/**
 * Its manifest's catalog and each kind's loaded studio; undefined until a load
 * has stored a catalog and every kind's studio, or when the stored catalog
 * isn't one Quick fastener reads.
 */
export async function getFastenerSet(
    db: Db,
    libraryId: LibraryId = FASTENER_LIBRARY
): Promise<FastenerSet | undefined> {
    const stored = await getGeneratedSet(db, libraryId, FASTENERS);
    const catalog = catalogSchema.safeParse(stored?.catalog);
    if (!catalog.success) {
        return undefined;
    }
    const rows = await db
        .select({
            insertableId: insertables.id,
            generatedStudio: insertables.generatedStudio,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            fastenInfo: insertables.fastenInfo,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(
            and(
                eq(insertables.libraryId, libraryId),
                like(insertables.generatedStudio, `${FASTENERS}/%`)
            )
        );
    const studios: Partial<Record<FastenerKind, FastenerStudio>> = {};
    for (const row of rows) {
        const kind = row.generatedStudio?.slice(FASTENERS.length + 1);
        if (!isKind(kind)) {
            continue;
        }
        studios[kind] = {
            insertableId: row.insertableId,
            parameters: row.parameters ?? [],
            location: {
                documentId: row.documentId,
                versionId: row.versionId,
                elementId: row.elementId
            },
            mateConnectorId: row.fastenInfo?.mateConnectorId
        };
    }
    if (!Object.values(FastenerKind).every((kind) => studios[kind])) {
        return undefined;
    }
    return {
        catalog: catalog.data,
        studios: studios as Record<FastenerKind, FastenerStudio>
    };
}

function isKind(key: string | undefined): key is FastenerKind {
    return Object.values(FastenerKind).includes(key as FastenerKind);
}

/** A run's inserts, recorded as any insert from the library its studios are in. */
import { inArray } from "drizzle-orm";
import { type Db } from "../../db/client";
import { insertables } from "../../db/schema";
import { ElementType } from "../../lib/onshape/element-type";
import { toElementPath } from "../../lib/onshape/path";
import { type InsertEvent, recordInserts } from "../analytics/tracking";
import { InsertSource } from "../analytics/usage";
import { toSelection } from "../configurations/selection";
import { type PartPlacement } from "./insert";
import { type FastenerSet } from "./studios";

/** Each part with an occurrence is an insert; a part is fastened once its mate is in. */
export async function recordRunInserts(
    db: Db,
    userId: string,
    set: FastenerSet,
    parts: PartPlacement[],
    paths: (string[] | null)[],
    mated: Set<number>
): Promise<void> {
    const studios = Object.values(set.studios);
    const rows = await db
        .select({
            id: insertables.id,
            libraryId: insertables.libraryId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId
        })
        .from(insertables)
        .where(
            inArray(
                insertables.id,
                studios.map((studio) => studio.insertableId)
            )
        )
        .all();
    const byId = new Map(rows.map((row) => [row.id, row]));

    const inserts = parts.flatMap((part, index): InsertEvent[] => {
        const studio = set.studios[part.kind];
        const row = byId.get(studio.insertableId);
        if (!paths[index] || !row) {
            return [];
        }
        return [
            {
                libraryId: row.libraryId,
                path: toElementPath(row),
                insertableId: studio.insertableId,
                targetElementType: ElementType.ASSEMBLY,
                selection: toSelection(part.configuration, studio.parameters),
                parameters: studio.parameters,
                // Not looked up: a run picks parts by size, not from favorites
                isFavorite: false,
                isQuickInsert: false,
                source: InsertSource.QUICK_FASTENER,
                fasten: mated.has(index),
                fastenable: true,
                preselected: false
            }
        ];
    });
    await recordInserts(db, userId, inserts);
}

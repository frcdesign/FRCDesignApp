/** A run's inserts, recorded as any insert from the library its studios are in. */
import { inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import { type AppBindings } from "../../lib/context";
import { insertables } from "../../db/schema";
import { ElementType } from "../../lib/onshape/element-type";
import { toElementPath } from "../../lib/onshape/path";
import { type InsertEvent, recordInserts } from "../analytics/tracking";
import { UseSource } from "../analytics/usage";
import { toSelection } from "../configurations/selection";
import { DeclaredPartStatus } from "./contract";
import { type DeclaredPlan } from "./declared";
import { type PartPlacement } from "./insert";
import { type FastenerSet } from "./studios";

/** Each part with an occurrence is an insert; a part is fastened once its mate is in. */
export async function recordRunInserts(
    env: Pick<AppBindings, "DB" | "EVENT_LOG">,
    userId: string,
    set: FastenerSet,
    parts: PartPlacement[],
    paths: (string[] | null)[],
    mated: Set<number>
): Promise<void> {
    const studios = Object.values(set.studios);
    const rows = await getDb(env.DB)
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
                source: UseSource.AUTO_ASSEMBLY,
                fasten: mated.has(index),
                fastenable: true,
                preselected: false,
                atInsertLocation: false
            }
        ];
    });
    await recordInserts(env, userId, inserts);
}

/** Each declared part inserted is a use of its product, fastened once its mate is in. */
export async function recordDeclaredInserts(
    env: Pick<AppBindings, "DB" | "EVENT_LOG">,
    userId: string,
    plans: DeclaredPlan[],
    paths: (string[] | null)[],
    mated: Set<number>
): Promise<void> {
    const ready = plans.filter(
        (plan) => plan.status === DeclaredPartStatus.READY
    );
    const inserts = ready.flatMap((plan, index): InsertEvent[] => {
        const { product } = plan;
        if (!paths[index] || !product) {
            return [];
        }
        return [
            {
                libraryId: product.libraryId,
                path: toElementPath(product),
                insertableId: product.insertableId,
                targetElementType: ElementType.ASSEMBLY,
                selection: toSelection(
                    plan.connector.declaration.configuration,
                    product.parameters
                ),
                parameters: product.parameters,
                isFavorite: false,
                isQuickInsert: false,
                source: UseSource.FEATURESCRIPT_PARTS,
                fasten: mated.has(index),
                fastenable: true,
                preselected: false,
                atInsertLocation: false
            }
        ];
    });
    await recordInserts(env, userId, inserts);
}

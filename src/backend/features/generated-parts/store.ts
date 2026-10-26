/** The generated sets a library loaded, each its manifest less its studios. */
import { and, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { generatedSets } from "../../db/schema";
import { type LibraryId } from "../library/library-id";
import { type GeneratedFeature, type ReleasedCatalog } from "./manifest";

export interface GeneratedSetRow extends ReleasedCatalog {
    libraryId: LibraryId;
    set: string;
    groupId: string;
    versionId: string;
}

export async function saveGeneratedSet(
    db: Db,
    row: GeneratedSetRow
): Promise<void> {
    await db
        .insert(generatedSets)
        .values(row)
        .onConflictDoUpdate({
            target: [generatedSets.libraryId, generatedSets.set],
            set: {
                groupId: row.groupId,
                versionId: row.versionId,
                features: row.features,
                catalog: row.catalog
            }
        });
}

export async function getGeneratedSet(
    db: Db,
    libraryId: LibraryId,
    set: string
): Promise<GeneratedSetRow | undefined> {
    const row = await db
        .select()
        .from(generatedSets)
        .where(
            and(
                eq(generatedSets.libraryId, libraryId),
                eq(generatedSets.set, set)
            )
        )
        .get();
    return row && { ...row, catalog: row.catalog as Record<string, unknown> };
}

/** Every loaded set's studio features, each once. */
export async function generatedFeatures(db: Db): Promise<GeneratedFeature[]> {
    const rows = await db
        .select({ features: generatedSets.features })
        .from(generatedSets);
    const byType = new Map(
        rows
            .flatMap((row) => Object.values(row.features))
            .map((feature) => [feature.type, feature])
    );
    return [...byType.values()];
}

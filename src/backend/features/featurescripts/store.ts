import { asc } from "drizzle-orm";
import { type Db } from "../../db/client";
import { featureScripts, featureScriptsDocument } from "./schema";
import { type FeatureScriptsOut } from "./contract";

/** Everything stored for icons, kept apart from thumbnails. */
export const ICON_PREFIX = "featurescript-icons/";

export function iconKey(elementId: string, microversionId: string): string {
    return `${ICON_PREFIX}${elementId}/${microversionId}.svg`;
}

/** The app url serving an icon; the microversion makes it immutable. */
export function iconUrl(elementId: string, microversionId: string): string {
    const query = new URLSearchParams({ v: microversionId });
    return `/api/featurescripts/icon/${elementId}?${query.toString()}`;
}

export async function getCacheVersion(db: Db): Promise<number> {
    const document = await db
        .select({ cacheVersion: featureScriptsDocument.cacheVersion })
        .from(featureScriptsDocument)
        .get();
    return document?.cacheVersion ?? 0;
}

export async function getFeatureScriptsOut(db: Db): Promise<FeatureScriptsOut> {
    const [document, rows] = await Promise.all([
        db.select().from(featureScriptsDocument).get(),
        db.select().from(featureScripts).orderBy(asc(featureScripts.sortOrder))
    ]);
    return {
        documentId: document?.documentId,
        versionId: document?.versionId,
        features: rows.map((row) => ({
            id: row.id,
            elementId: row.elementId,
            name: row.name,
            description: row.description,
            category: row.category ?? undefined,
            releaseVersion: row.releaseVersion ?? undefined,
            sourceUrl: row.sourceUrl ?? undefined,
            isVisible: row.isVisible,
            iconUrl:
                row.iconElementId && row.iconMicroversionId
                    ? iconUrl(row.iconElementId, row.iconMicroversionId)
                    : undefined,
            exampleElementId: row.exampleElementId ?? undefined,
            thumbnailUrls: row.thumbnailUrls ?? undefined,
            problems: row.problems
        }))
    };
}

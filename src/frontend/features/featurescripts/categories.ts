import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";

export interface FeatureScriptCategory {
    /** The frontend document's folder; undefined for the features at its top level. */
    name?: string;
    features: FeatureScriptOut[];
}

/**
 * In the order the folders come in the frontend document, which the features'
 * tab order follows; the uncategorized last, since a release puts a new
 * feature there until it is filed.
 */
export function groupByCategory(
    features: FeatureScriptOut[]
): FeatureScriptCategory[] {
    const byName = new Map<string | undefined, FeatureScriptOut[]>();
    for (const feature of features) {
        byName.set(feature.category, [
            ...(byName.get(feature.category) ?? []),
            feature
        ]);
    }
    const uncategorized = byName.get(undefined);
    byName.delete(undefined);
    const categories: FeatureScriptCategory[] = [...byName].map(
        ([name, grouped]) => ({ name, features: grouped })
    );
    return uncategorized
        ? [...categories, { features: uncategorized }]
        : categories;
}

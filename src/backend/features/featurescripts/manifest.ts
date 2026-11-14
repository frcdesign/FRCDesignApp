/**
 * Reads the frontend document: its manifest, and what the manifest leaves to
 * the document's own layout, each feature's example and category.
 */
import * as z from "zod";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    OnshapeElementType,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";

export const MANIFEST_TAB_NAME = "featurescripts.json";
export const MANIFEST_SCHEMA_VERSION = 1;

const manifestFeature = z.object({
    studioElementId: z.string().min(1),
    featureType: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    version: z.string().optional(),
    iconElementId: z.string().min(1).nullish(),
    sourceUrl: z.url().optional()
});

const manifestSchema = z.object({
    schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
    features: z.array(manifestFeature)
});

export type FeatureScriptsManifest = z.infer<typeof manifestSchema>;
export type ManifestFeature = z.infer<typeof manifestFeature>;

/** The manifest tab, at the document's top level. */
export function findManifestTab(
    contents: OnshapeDocumentContents
): OnshapeElement | undefined {
    const topLevel = new Set(
        contents.folders.groups.flatMap((entry) =>
            entry.btType === OnshapeFolderEntryType.ELEMENT
                ? [entry.elementId]
                : []
        )
    );
    return contents.elements.find(
        (element) =>
            element.elementType === OnshapeElementType.BLOB &&
            element.name === MANIFEST_TAB_NAME &&
            topLevel.has(element.id)
    );
}

/** Refuses a file of another schema version, or one that doesn't parse. */
export function parseManifest(json: unknown): FeatureScriptsManifest {
    return manifestSchema.parse(json);
}

/** Where a tab sits: the folders holding it, outermost first, and its siblings in tab order. */
interface TabPlace {
    folderNames: (string | undefined)[];
    siblings: OnshapeFolderEntry[];
    index: number;
}

function findPlace(
    entries: OnshapeFolderEntry[],
    elementId: string,
    folderNames: (string | undefined)[] = []
): TabPlace | undefined {
    for (const [index, entry] of entries.entries()) {
        if (entry.btType === OnshapeFolderEntryType.ELEMENT) {
            if (entry.elementId === elementId) {
                return { folderNames, siblings: entries, index };
            }
        } else {
            const place = findPlace(entry.groups, elementId, [
                ...folderNames,
                entry.groupName
            ]);
            if (place) {
                return place;
            }
        }
    }
    return undefined;
}

/** In tab-bar order, from the folder tree; tabs Onshape omits from the tree last. */
function inTabOrder(contents: OnshapeDocumentContents): OnshapeElement[] {
    const byId = new Map(contents.elements.map((tab) => [tab.id, tab]));
    const ordered: OnshapeElement[] = [];
    const walk = (entries: OnshapeFolderEntry[]) => {
        for (const entry of entries) {
            if (entry.btType === OnshapeFolderEntryType.GROUP) {
                walk(entry.groups);
            } else {
                const tab = byId.get(entry.elementId);
                if (tab) {
                    ordered.push(tab);
                    byId.delete(entry.elementId);
                }
            }
        }
    };
    walk(contents.folders.groups);
    return [...ordered, ...byId.values()];
}

const isPartStudio = (tab: OnshapeElement | undefined): tab is OnshapeElement =>
    tab?.elementType === OnshapeElementType.PART_STUDIO;

/**
 * The Part Studio named for the feature, preferring one after its Feature
 * Studio in the same folder; else the first Part Studio after the Feature
 * Studio in its folder, which features sharing an example sit before. Pass
 * contents with deprecated tabs already left out.
 */
export function findExample(
    contents: OnshapeDocumentContents,
    studioElementId: string,
    featureName: string
): OnshapeElement | undefined {
    const byId = new Map(contents.elements.map((tab) => [tab.id, tab]));
    const place = findPlace(contents.folders.groups, studioElementId);
    const after = (place?.siblings.slice(place.index + 1) ?? []).flatMap(
        (entry) => {
            const tab =
                entry.btType === OnshapeFolderEntryType.ELEMENT
                    ? byId.get(entry.elementId)
                    : undefined;
            return isPartStudio(tab) ? [tab] : [];
        }
    );

    const wanted = featureName.trim().toLowerCase();
    const isNamed = (tab: OnshapeElement) =>
        tab.name.trim().toLowerCase() === wanted;
    return (
        after.find(isNamed) ??
        inTabOrder(contents).find((tab) => isPartStudio(tab) && isNamed(tab)) ??
        after[0]
    );
}

/** The outermost folder holding a tab; undefined at the top level. */
export function categoryOf(
    contents: OnshapeDocumentContents,
    elementId: string
): string | undefined {
    return findPlace(contents.folders.groups, elementId)?.folderNames[0];
}

/** Each tab's position in tab-bar order, which sorts the list. */
export function tabOrder(
    contents: OnshapeDocumentContents
): Map<string, number> {
    return new Map(inTabOrder(contents).map((tab, index) => [tab.id, index]));
}

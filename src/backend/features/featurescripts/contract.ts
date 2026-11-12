/** What the FeatureScripts tab is sent and sends. A leaf, so the frontend can import it. */
import * as z from "zod";
import { INSTANCE_TYPES } from "../../lib/onshape/path";
import type { ThumbnailUrls } from "../thumbnails/contract";

export enum FeatureScriptProblem {
    NO_EXAMPLE = "no-example",
    NO_ICON = "no-icon",
    LOAD_FAILED = "load-failed"
}

export interface FeatureScriptOut {
    id: string;
    /** The frontend Feature Studio's tab, which **Get FeatureScript** opens. */
    elementId: string;
    name: string;
    description: string;
    /** The frontend document's folder it is in; absent at the top level. */
    category?: string;
    /** Shown to everyone; the owner sees a hidden one too, marked. */
    isVisible: boolean;
    /** Absent without an icon tab. */
    iconUrl?: string;
    exampleElementId?: string;
    /** Absent without an example. */
    thumbnailUrls?: ThumbnailUrls;
    /** e.g. "1.3.0", from the manifest; shown to the owner alone. */
    releaseVersion?: string;
    /** The released file on GitHub, at its release's tag. */
    sourceUrl?: string;
    /** Shown to the owner alone. */
    problems: FeatureScriptProblem[];
}

export interface FeatureScriptsOut {
    /** The frontend version loaded, for **Open example**; absent before the first load. */
    documentId?: string;
    versionId?: string;
    /** In the frontend document's tab order. */
    features: FeatureScriptOut[];
}

/** The caller's favorites, oldest first. */
export interface FeatureScriptFavoritesOut {
    featureScriptIds: string[];
}

export interface FeatureScriptsVersionOut {
    version: number;
}

/** Left out of everyone's list but the owner's. */
export function isHidden(feature: FeatureScriptOut): boolean {
    return !feature.isVisible;
}

export const featureScriptVisibilityBody = z.object({
    isVisible: z.boolean()
});

export const addFeatureScriptBody = z.object({
    /** A Part Studio in a workspace. */
    targetPath: z.object({
        documentId: z.string().min(1),
        instanceId: z.string().min(1),
        instanceType: z.enum(INSTANCE_TYPES),
        elementId: z.string().min(1)
    })
});

export type AddFeatureScriptIn = z.infer<typeof addFeatureScriptBody>;

/** The feature to open in the Part Studio. */
export interface AddFeatureScriptOut {
    featureId?: string;
}

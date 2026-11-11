/** The Onshape calls behind one check: three for a Part Studio, two for an Assembly. */
import { ElementType } from "../../lib/onshape/element-type";
import {
    OnshapeApiError,
    type OnshapeApi,
    OnshapeTimeoutError
} from "../../lib/onshape/client";
import { type ElementPath } from "../../lib/onshape/path";
import {
    getAssembly,
    getAssemblyFeatures
} from "../../lib/onshape/endpoints/assemblies";
import {
    getAllFeatures,
    getSketches
} from "../../lib/onshape/endpoints/part-studios";
import { getParts } from "../../lib/onshape/endpoints/parts";
import type {
    OnshapeAssemblyDefinition,
    OnshapeFeatureListResponse,
    OnshapePart,
    OnshapeSketchList
} from "../../lib/onshape/types";

export interface PartStudioSnapshot {
    elementType: ElementType.PART_STUDIO;
    features: OnshapeFeatureListResponse;
    /** Undefined when Onshape couldn't list them; the rest is still checked. */
    sketches: OnshapeSketchList | undefined;
    parts: OnshapePart[];
}

export interface AssemblySnapshot {
    elementType: ElementType.ASSEMBLY;
    definition: OnshapeAssemblyDefinition;
    features: OnshapeFeatureListResponse;
}

export type DesignSnapshot = PartStudioSnapshot | AssemblySnapshot;

/** In the default configuration: the launch doesn't say which one is showing. */
export async function readSnapshot(
    client: OnshapeApi,
    path: ElementPath,
    elementType: ElementType
): Promise<DesignSnapshot> {
    switch (elementType) {
        case ElementType.PART_STUDIO: {
            const [features, sketches, parts] = await Promise.all([
                getAllFeatures(client, path),
                getSketches(client, path).catch(skipSketches),
                getParts(client, path, {})
            ]);
            return { elementType, features, sketches, parts };
        }
        case ElementType.ASSEMBLY: {
            const [definition, features] = await Promise.all([
                getAssembly(client, path, { includeMateFeatures: true }),
                getAssemblyFeatures(client, path)
            ]);
            return { elementType, definition, features };
        }
    }
}

/** Onshape turning the caller away, which fails a whole check rather than one part of it. */
export function isRefusal(error: unknown): boolean {
    return (
        error instanceof OnshapeApiError &&
        (error.status === 401 || error.status === 403 || error.status === 429)
    );
}

/** Onshape failing to answer, as opposed to a bug of ours. */
export function isOnshapeFailure(error: unknown): boolean {
    return (
        error instanceof OnshapeApiError || error instanceof OnshapeTimeoutError
    );
}

/** Sketch status is one check of many, so its failure alone doesn't fail the rest. */
function skipSketches(error: unknown): undefined {
    if (!isOnshapeFailure(error) || isRefusal(error)) {
        throw error;
    }
    console.warn("Skipping sketch status", error);
    return undefined;
}

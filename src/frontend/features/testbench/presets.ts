/**
 * The calls whose rate limits matter: the uncached ones Auto Assembly and
 * insert make per hole or per part, against the tabs pasted urls name.
 */
import {
    toElementApiPath,
    toInstanceApiPath,
    type ElementPath
} from "@backend/lib/onshape/path";
import type {
    OnshapeCallBody,
    OnshapeMethod
} from "@backend/features/testbench/contract";
import { ONSHAPE_API_VERSION } from "@backend/lib/onshape/client";

export enum PresetId {
    EVALUATE_FEATURESCRIPT = "evaluate-featurescript",
    PART_STUDIO_FEATURES = "part-studio-features",
    ASSEMBLY_DEFINITION = "assembly-definition",
    ASSEMBLY_FEATURES = "assembly-features",
    DOCUMENT_ELEMENTS = "document-elements",
    SESSION_INFO = "session-info"
}

export const PRESET_IDS = Object.values(PresetId);

/** A cheap script, so the check costs Onshape little beyond the endpoint itself. */
export const DEFAULT_SCRIPT =
    "function(context is Context, queries is map) { return size(evaluateQuery(context, qEverything(EntityType.BODY))); }";

interface PresetCall {
    method: OnshapeMethod;
    path: string;
    body?: unknown;
}

/** The tabs the presets call against, each pasted as a url. */
export interface PresetElements {
    partStudio?: ElementPath;
    assembly?: ElementPath;
}

/** Undefined when the preset needs an element and none was given. */
export function presetCall(
    id: PresetId,
    elements: PresetElements,
    script: string
): OnshapeCallBody | undefined {
    const call = presetPath(id, elements, script);
    return call && { ...call, version: ONSHAPE_API_VERSION };
}

function presetPath(
    id: PresetId,
    elements: PresetElements,
    script: string
): PresetCall | undefined {
    const { partStudio, assembly } = elements;
    switch (id) {
        case PresetId.SESSION_INFO:
            return { method: "GET", path: "/users/sessioninfo" };
        case PresetId.EVALUATE_FEATURESCRIPT:
            return (
                partStudio && {
                    method: "POST",
                    path: `/partstudios${toElementApiPath(partStudio)}/featurescript`,
                    body: { script }
                }
            );
        case PresetId.PART_STUDIO_FEATURES:
            return (
                partStudio && {
                    method: "GET",
                    path: `/partstudios${toElementApiPath(partStudio)}/features`
                }
            );
        case PresetId.ASSEMBLY_DEFINITION:
            return (
                assembly && {
                    method: "GET",
                    path: `/assemblies${toElementApiPath(assembly)}`
                }
            );
        case PresetId.ASSEMBLY_FEATURES:
            return (
                assembly && {
                    method: "GET",
                    path: `/assemblies${toElementApiPath(assembly)}/features`
                }
            );
        case PresetId.DOCUMENT_ELEMENTS: {
            const element = partStudio ?? assembly;
            return (
                element && {
                    method: "GET",
                    path: `/documents${toInstanceApiPath(element)}/elements`
                }
            );
        }
    }
}

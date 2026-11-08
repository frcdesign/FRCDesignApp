/**
 * The calls a burst can repeat: the uncached ones Auto Assembly and insert make
 * per hole or per part, against the element a pasted url names.
 */
import { toElementApiPath, type ElementPath } from "@backend/lib/onshape/path";
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

/** The smallest script Onshape will evaluate, so the burst measures the endpoint. */
export const DEFAULT_SCRIPT =
    "function(context is Context, queries is map) { return size(evaluateQuery(context, qEverything(EntityType.BODY))); }";

interface PresetCall {
    method: OnshapeMethod;
    path: string;
    body?: unknown;
}

/** Undefined when the preset needs an element and none was given. */
export function presetCall(
    id: PresetId,
    element: ElementPath | undefined,
    script: string
): OnshapeCallBody | undefined {
    const call = presetPath(id, element, script);
    return (
        call && { ...call, version: ONSHAPE_API_VERSION, includeBody: false }
    );
}

function presetPath(
    id: PresetId,
    element: ElementPath | undefined,
    script: string
): PresetCall | undefined {
    if (id === PresetId.SESSION_INFO) {
        return { method: "GET", path: "/users/sessioninfo" };
    }
    if (!element) {
        return undefined;
    }
    const at = toElementApiPath(element);
    switch (id) {
        case PresetId.EVALUATE_FEATURESCRIPT:
            return {
                method: "POST",
                path: `/partstudios${at}/featurescript`,
                body: { script, queries: [] }
            };
        case PresetId.PART_STUDIO_FEATURES:
            return { method: "GET", path: `/partstudios${at}/features` };
        case PresetId.ASSEMBLY_DEFINITION:
            return { method: "GET", path: `/assemblies${at}` };
        case PresetId.ASSEMBLY_FEATURES:
            return { method: "GET", path: `/assemblies${at}/features` };
        case PresetId.DOCUMENT_ELEMENTS: {
            const { documentId, instanceType, instanceId } = element;
            return {
                method: "GET",
                path: `/documents/d/${documentId}/${instanceType}/${instanceId}/elements`
            };
        }
    }
}

import { OnshapeApi } from "../client";
import { assertWorkspace } from "../assertions";
import { ElementPath, toElementApiObject, toElementApiPath } from "../path";
import { PartType } from "./documents";
import { ElementType } from "../element-type";
import { IDENTITY_TRANSFORM } from "../objects/transform";
import {
    OnshapeAssemblyDefinition,
    OnshapeBoundingBox,
    OnshapeCreatedFeature,
    OnshapeInsertInstancesResponse
} from "../types";

/** Retrieves information about an assembly. */
export function getAssembly(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    options: {
        includeNonSolids?: boolean;
        includeMateFeatures?: boolean;
        includeMateConnectors?: boolean;
        excludeSuppressed?: boolean;
    } = {}
): Promise<OnshapeAssemblyDefinition> {
    return client.get(`/assemblies${toElementApiPath(assemblyPath)}`, {
        query: new URLSearchParams({
            includeMateFeatures: String(options.includeMateFeatures ?? false),
            includeNonSolids: String(options.includeNonSolids ?? false),
            excludeSuppressed: String(options.excludeSuppressed ?? true),
            includeMateConnectors: String(
                options.includeMateConnectors ?? false
            )
        })
    });
}

/**
 * Adds the contents of an element tab to an assembly. For a part studio,
 * `options.partTypes` defaults to PARTS and COMPOSITE_PARTS.
 */
export function addElementToAssembly(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    elementPath: ElementPath,
    elementType: ElementType,
    options: {
        /** Encoded `id=value;…`, as the caller wants Onshape told it. */
        configuration?: string;
        partTypes?: PartType[];
        /** Where to land it; the origin when left out. */
        transform?: number[];
    } = {}
): Promise<OnshapeInsertInstancesResponse> {
    assertWorkspace(assemblyPath);

    const { configuration, partTypes, transform } = options;

    const instance: Record<string, unknown> = {
        ...toElementApiObject(elementPath)
    };

    // An empty configuration is left off rather than sent as "", which Onshape
    // treats the same way. A caller Onshape does need told something — a part
    // studio insert is one — passes a non-empty configuration instead.
    if (configuration) {
        instance.configuration = configuration;
    }

    if (elementType === ElementType.ASSEMBLY) {
        instance.isAssembly = true;
    } else {
        instance.includePartTypes = partTypes ?? [
            PartType.PARTS,
            PartType.COMPOSITE_PARTS
        ];
        instance.isWholePartStudio = true;
    }

    return insertInstance(client, assemblyPath, instance, transform);
}

/**
 * What the assembly's geometry spans, in metres. Sketches are left out, so a
 * marker already in the assembly does not widen it.
 */
export function getAssemblyBoundingBox(
    client: OnshapeApi,
    assemblyPath: ElementPath
): Promise<OnshapeBoundingBox> {
    return client.get(
        `/assemblies${toElementApiPath(assemblyPath)}/boundingboxes`,
        { query: { includeSketches: "false" } }
    );
}

/**
 * Inserts one part studio feature — a sketch — as an instance of its own.
 * Onshape takes the same instance definition as a part insert, naming the
 * feature in place of the part types to include.
 */
export function addFeatureToAssembly(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    elementPath: ElementPath,
    featureId: string,
    transform?: number[]
): Promise<OnshapeInsertInstancesResponse> {
    assertWorkspace(assemblyPath);
    return insertInstance(
        client,
        assemblyPath,
        { ...toElementApiObject(elementPath), featureId },
        transform
    );
}

/** The one call both inserts are: an instance, and where to land it. */
function insertInstance(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    instance: Record<string, unknown>,
    transform?: number[]
): Promise<OnshapeInsertInstancesResponse> {
    return client.post(
        `/assemblies${toElementApiPath(assemblyPath)}/transformedinstances`,
        {
            body: {
                transformGroups: [
                    {
                        instances: [instance],
                        transform: transform ?? IDENTITY_TRANSFORM
                    }
                ]
            }
        }
    );
}

/** Adds a feature to an assembly. */
export function addAssemblyFeature(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    feature: object
): Promise<OnshapeCreatedFeature> {
    assertWorkspace(assemblyPath);
    return client.post(
        `/assemblies${toElementApiPath(assemblyPath)}/features`,
        { body: { feature } }
    );
}

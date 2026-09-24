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

/** For a part studio, `options.partTypes` defaults to PARTS and COMPOSITE_PARTS. */
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

    // Onshape treats an empty configuration as absent.
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

/** In metres. Excludes sketches, so a marker doesn't widen it. */
export function getAssemblyBoundingBox(
    client: OnshapeApi,
    assemblyPath: ElementPath
): Promise<OnshapeBoundingBox> {
    return client.get(
        `/assemblies${toElementApiPath(assemblyPath)}/boundingboxes`,
        { query: { includeSketches: "false" } }
    );
}

/** Inserts a single part studio feature, such as a sketch. */
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

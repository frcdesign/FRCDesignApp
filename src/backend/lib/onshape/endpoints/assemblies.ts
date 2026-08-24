import { OnshapeApi } from "../client";
import { assertWorkspace } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiObject,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";
import { encodeConfiguration } from "./configurations";
import { OnshapeElementType, PartType } from "./documents";
import { IDENTITY_TRANSFORM } from "../objects/constants";
import {
    OnshapeAssemblyDefinition,
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
    return client.get(apiPath("assemblies", assemblyPath, toElementApiPath), {
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
 * Returns features in an assembly.
 *
 * @param featureIds Feature IDs to retrieve. If omitted, all features are returned.
 */
export function getAssemblyFeatures(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    featureIds: string[] = []
): Promise<any> {
    return client.get(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "features"
        }),
        {
            query: new URLSearchParams(
                featureIds.map((id) => ["featureId", id])
            )
        }
    );
}

export function createAssembly(
    client: OnshapeApi,
    workspacePath: InstancePath,
    assemblyName: string
): Promise<any> {
    assertWorkspace(workspacePath);
    return client.post(
        apiPath("assemblies", workspacePath, toInstanceApiPath),
        {
            body: { name: assemblyName }
        }
    );
}

/**
 * Adds the contents of an element tab to an assembly. For a part studio,
 * `options.partTypes` defaults to PARTS and COMPOSITE_PARTS.
 */
export function addElementToAssembly(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    elementPath: ElementPath,
    elementType: OnshapeElementType,
    options: {
        configuration?: Record<string, string> | string;
        partTypes?: PartType[];
    } = {}
): Promise<OnshapeInsertInstancesResponse> {
    assertWorkspace(assemblyPath);

    const { configuration, partTypes } = options;

    const instance: Record<string, unknown> = {
        ...toElementApiObject(elementPath)
    };

    if (configuration !== undefined) {
        instance.configuration =
            typeof configuration === "string"
                ? configuration
                : encodeConfiguration(configuration);
    }

    if (elementType === OnshapeElementType.ASSEMBLY) {
        instance.isAssembly = true;
    } else if (elementType === OnshapeElementType.PART_STUDIO) {
        instance.includePartTypes = partTypes ?? [
            PartType.PARTS,
            PartType.COMPOSITE_PARTS
        ];
        instance.isWholePartStudio = true;
    } else {
        throw new Error(
            `Element type must be a part studio or assembly, got ${elementType}`
        );
    }

    return client.post(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "transformedinstances"
        }),
        {
            body: {
                transformGroups: [
                    { instances: [instance], transform: IDENTITY_TRANSFORM }
                ]
            }
        }
    );
}

/**
 * `isRelative` transforms from the instance's existing location rather than the
 * assembly origin.
 */
export function transformInstance(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    instanceId: string,
    transform: number[],
    isRelative = false
): Promise<any> {
    assertWorkspace(assemblyPath);
    return client.post(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "occurrencetransforms"
        }),
        {
            body: {
                isRelative,
                occurrences: [{ path: [instanceId] }],
                transform
            }
        }
    );
}

/**
 * Adds or updates a feature in an assembly.
 *
 * @param featureId If specified, the existing feature with this ID is updated rather than creating a new one.
 */
export function addAssemblyFeature(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    feature: object,
    featureId?: string
): Promise<OnshapeCreatedFeature> {
    assertWorkspace(assemblyPath);
    return client.post(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "features",
            featureId
        }),
        { body: { feature } }
    );
}

export function deleteFeature(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    featureId: string
): Promise<any> {
    assertWorkspace(assemblyPath);
    return client.delete(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "features",
            featureId
        })
    );
}

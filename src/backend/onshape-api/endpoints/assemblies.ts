import { OnshapeApi } from "../onshape-api";
import { assertWorkspace } from "../assertions";
import {
    ElementPath,
    InstancePath,
    toElementApiObject,
    toElementApiPath,
    toInstanceApiPath
} from "../../../shared/path";
import { apiPath } from "../api-path";
import { encodeConfiguration } from "./configurations";
import { OnshapeElementType, PartType } from "./documents";
import { IDENTITY_TRANSFORM } from "../objects/constants";

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
): Promise<any> {
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

/** Constructs an assembly with the given name. */
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
 * Adds the contents of an element tab to an assembly.
 *
 * @param elementType The type of the element being inserted (part studio or assembly).
 * @param options.partTypes If inserting a part studio, the types of parts to include. Defaults to PARTS and COMPOSITE_PARTS.
 * @param options.useTransform If true, uses the `transformedinstances` endpoint and returns a result.
 */
export function addElementToAssembly(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    elementPath: ElementPath,
    elementType: OnshapeElementType,
    options: {
        configuration?: Record<string, string> | string;
        partTypes?: PartType[];
        useTransform?: boolean;
    } = {}
): Promise<any> {
    assertWorkspace(assemblyPath);

    const { configuration, partTypes, useTransform = false } = options;

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

    if (useTransform) {
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

    return client.postNone(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "instances"
        }),
        { body: instance }
    );
}

/**
 * Applies a transform to an instance in an assembly.
 *
 * @param isRelative True to apply the transform relative to the instance's existing location,
 * false to apply it relative to the assembly origin.
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
): Promise<any> {
    assertWorkspace(assemblyPath);
    return client.post(
        apiPath("assemblies", assemblyPath, toElementApiPath, {
            endRoute: "features",
            featureId
        }),
        { body: { feature } }
    );
}

/** Deletes a feature from an assembly. */
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

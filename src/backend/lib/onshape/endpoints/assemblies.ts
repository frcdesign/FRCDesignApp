import { OnshapeApi } from "../client";
import { assertWorkspace } from "../assertions";
import {
    ElementPath,
    toElementApiObject,
    toElementApiPath
} from "../path";
import { apiPath } from "../api-path";
import { encodeConfiguration } from "../../../features/configurations/utils";
import { PartType } from "./documents";
import { ElementType } from "../element-type";
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
 * Adds the contents of an element tab to an assembly. For a part studio,
 * `options.partTypes` defaults to PARTS and COMPOSITE_PARTS.
 */
export function addElementToAssembly(
    client: OnshapeApi,
    assemblyPath: ElementPath,
    elementPath: ElementPath,
    elementType: ElementType,
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

    if (elementType === ElementType.ASSEMBLY) {
        instance.isAssembly = true;
    } else {
        instance.includePartTypes = partTypes ?? [
            PartType.PARTS,
            PartType.COMPOSITE_PARTS
        ];
        instance.isWholePartStudio = true;
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

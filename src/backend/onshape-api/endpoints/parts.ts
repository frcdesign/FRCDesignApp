import { OnshapeApi } from "../onshape-api";
import { ElementPath, toElementApiPath } from "../../../shared/onshape-path";
import { apiPath } from "../api-path";
import { encodeConfigurationForQuery } from "../../../shared/configuration-utils";
import { ParameterValues } from "../../../shared/configuration-models";
import type { OnshapeAssemblyDefinition, OnshapePart } from "../onshape-types";

/**
 * Builds the `configuration` query for an element request. The value is the
 * raw `id=value;…` form; `createSearchParams` URL-encodes it.
 */
function configurationQuery(
    configuration: ParameterValues
): Record<string, string> {
    const encoded = encodeConfigurationForQuery(configuration);
    return encoded ? { configuration: encoded } : {};
}

/** Returns the parts of a part studio for a given configuration. */
export function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: ParameterValues
): Promise<OnshapePart[]> {
    return client.get(apiPath("parts", elementPath, toElementApiPath), {
        query: configurationQuery(configuration)
    });
}

/** Returns the assembly definition for a given configuration. */
export function getAssemblyDefinition(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: ParameterValues
): Promise<OnshapeAssemblyDefinition> {
    return client.get(apiPath("assemblies", elementPath, toElementApiPath), {
        query: configurationQuery(configuration)
    });
}

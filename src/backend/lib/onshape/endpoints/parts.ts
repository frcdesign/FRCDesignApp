import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { encodeConfiguration } from "../../../features/configurations/utils";
import { Selection } from "../../../features/configurations/models";
import type { OnshapeAssemblyDefinition, OnshapePart } from "../types";

/**
 * Builds the `configuration` query for an element request. The value is the
 * raw `id=value;…` form; `createSearchParams` URL-encodes it.
 */
function configurationQuery(selection: Selection): Record<string, string> {
    const encoded = encodeConfiguration(selection);
    return encoded ? { configuration: encoded } : {};
}

/** Returns the parts of a part studio for a given configuration. */
export function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    selection: Selection
): Promise<OnshapePart[]> {
    return client.get(apiPath("parts", elementPath, toElementApiPath), {
        query: configurationQuery(selection)
    });
}

/** Returns the assembly definition for a given configuration. */
export function getAssemblyDefinition(
    client: OnshapeApi,
    elementPath: ElementPath,
    selection: Selection
): Promise<OnshapeAssemblyDefinition> {
    return client.get(apiPath("assemblies", elementPath, toElementApiPath), {
        query: configurationQuery(selection)
    });
}

import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { encodeConfiguration } from "../../../features/configurations/utils";
import { ParameterValues } from "../../../features/configurations/models";
import type { OnshapeMetadataObject } from "../types";

/** Returns an element's metadata properties for a given configuration. */
export function getElementMetadata(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: ParameterValues
): Promise<OnshapeMetadataObject> {
    const encoded = encodeConfiguration(configuration);
    // Computed properties are expensive and unused, and indexing probes this
    // once per configuration.
    const query: Record<string, string> = {
        includeComputedProperties: "false"
    };
    if (encoded) query.configuration = encoded;
    return client.get(apiPath("metadata", elementPath, toElementApiPath), {
        query
    });
}

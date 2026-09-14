import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { type ConfigurationKey } from "../../../features/configurations/contract";
import type { OnshapeMetadataObject } from "../types";

/** Returns an element's metadata properties for a given configuration. */
export function getElementMetadata(
    client: OnshapeApi,
    elementPath: ElementPath,
    configurationKey: ConfigurationKey
): Promise<OnshapeMetadataObject> {
    // Computed properties are expensive and unused, and indexing probes this
    // once per configuration.
    const query: Record<string, string> = {
        includeComputedProperties: "false"
    };
    if (configurationKey) query.configuration = configurationKey;
    return client.get(apiPath("metadata", elementPath, toElementApiPath), {
        query
    });
}

import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import type { OnshapeMetadataObject } from "../types";

/** Returns an element's metadata properties for a given configuration. */
export function getElementMetadata(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<OnshapeMetadataObject> {
    // Computed properties are slow, and indexing probes once per configuration.
    const query: Record<string, string> = {
        includeComputedProperties: "false"
    };
    // The query form: this is escaped again on its way out.
    const encoded = encodeQueryConfiguration(configuration);
    if (encoded) {
        query.configuration = encoded;
    }
    return client.get(`/metadata${toElementApiPath(elementPath)}`, {
        query
    });
}

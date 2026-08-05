import { OnshapeApi } from "../onshape-api";
import { ElementPath, toElementApiPath } from "../../../shared/onshape-path";
import { apiPath } from "../api-path";
import { encodeConfigurationForQuery } from "../../../shared/configuration-utils";
import { ParameterValues } from "../../../shared/configuration-models";
import type { OnshapeMetadataObject } from "../onshape-types";

/** Returns an element's metadata properties for a given configuration. */
export function getElementMetadata(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: ParameterValues
): Promise<OnshapeMetadataObject> {
    const encoded = encodeConfigurationForQuery(configuration);
    return client.get(apiPath("metadata", elementPath, toElementApiPath), {
        query: encoded ? { configuration: encoded } : {}
    });
}

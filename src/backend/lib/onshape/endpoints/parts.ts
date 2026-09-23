import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import type { OnshapePart } from "../types";

/**
 * Returns the parts of a part studio, configured by what `configuration`
 * changes from the element's defaults.
 */
export function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<OnshapePart[]> {
    // The query form: this is escaped again on its way out.
    const encoded = encodeQueryConfiguration(configuration);
    return client.get(apiPath("parts", elementPath, toElementApiPath), {
        query: encoded ? { configuration: encoded } : {}
    });
}

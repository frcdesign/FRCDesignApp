import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { type ConfigurationKey } from "../../../features/configurations/contract";
import { toQueryConfiguration } from "../../../features/configurations/utils";
import type { OnshapePart } from "../types";

/** Returns the parts of a part studio for a given configuration. */
export function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    configurationKey: ConfigurationKey
): Promise<OnshapePart[]> {
    return client.get(apiPath("parts", elementPath, toElementApiPath), {
        // The query form, not the key: this is escaped again on its way out.
        query: configurationKey
            ? { configuration: toQueryConfiguration(configurationKey) }
            : {}
    });
}

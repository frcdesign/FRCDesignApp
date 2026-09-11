import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { OnshapeConfigurationResponse } from "../types";

export function getConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<OnshapeConfigurationResponse> {
    return client.get(
        apiPath("elements", elementPath, toElementApiPath, {
            endRoute: "configuration"
        })
    );
}

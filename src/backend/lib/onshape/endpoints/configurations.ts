import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import { OnshapeConfigurationResponse } from "../types";
import { type Selection } from "../../../features/configurations/models";

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

/**
 * For a request *body*, where no query-string layer will escape it again — so
 * unlike `encodeConfiguration`, every reserved character is escaped here.
 */
export function encodeConfigurationForBody(selection: Selection): string {
    return Object.entries(selection)
        .map(([id, value]) => `${id}=${encodeURIComponent(value)}`)
        .join(";");
}

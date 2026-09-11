import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { apiPath } from "../api-path";
import {
    OnshapeConfigurationParameter,
    OnshapeConfigurationResponse
} from "../types";
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

export function setConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath,
    parameters: OnshapeConfigurationParameter[] | null,
    currentConfiguration: unknown[] | null
): Promise<OnshapeConfigurationResponse> {
    return client.post(
        apiPath("elements", elementPath, toElementApiPath, {
            endRoute: "configuration"
        }),
        {
            body: {
                btType: "BTConfigurationResponse-2019",
                configurationParameters: parameters,
                currentConfiguration
            }
        }
    );
}

/**
 * For a request *body*, where nothing else will escape it — unlike
 * `encodeConfiguration`, which leaves values for a query string to encode.
 */
export function encodeConfigurationForBody(selection: Selection): string {
    return Object.entries(selection)
        .map(([id, value]) => `${id}=${encodeURIComponent(value)}`)
        .join(";");
}

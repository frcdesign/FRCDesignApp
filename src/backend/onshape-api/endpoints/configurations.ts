import { OnshapeApi } from "../client/onshape-api";
import { ElementPath, toElementApiPath } from "../../../shared/path";
import { apiPath } from "../api-path";

export function getConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath
): Promise<any> {
    return client.get(
        apiPath("elements", elementPath, toElementApiPath, {
            endRoute: "configuration"
        })
    );
}

export function setConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath,
    parameters: any[] | null,
    currentConfiguration: any[] | null
): Promise<any> {
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

/** Converts a configuration string back into a record mapping parameter IDs to values. */
export async function decodeConfiguration(
    client: OnshapeApi,
    elementPath: ElementPath,
    configurationString: string
): Promise<Record<string, string>> {
    const result = await client.get(
        apiPath("elements", elementPath, toElementApiPath, {
            endRoute: "configurationencodings",
            endId: configurationString
        })
    );
    return Object.fromEntries(
        result.parameters.map((p: any) => [p.parameterId, p.parameterValue])
    );
}

/** Encodes a configuration into a string suitable for passing to the Onshape API as a body parameter. */
export function encodeConfiguration(
    configuration: Record<string, string>
): string {
    return Object.entries(configuration)
        .map(([id, value]) => `${id}=${encodeURIComponent(value)}`)
        .join(";");
}

/** Encodes a configuration into a format suitable for passing to the Onshape API via a query parameter. */
export function encodeConfigurationForQuery(
    configuration: Record<string, string>
): string {
    return encodeURIComponent(
        Object.entries(configuration)
            .map(([id, value]) => `${id}=${value}`)
            .join(";")
    );
}

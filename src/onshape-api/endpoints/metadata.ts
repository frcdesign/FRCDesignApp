import { OnshapeClient } from "../client/client";
import {
    ElementPath,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../path";
import { apiPath } from "../api-path";

export function getInstanceMetadata(
    client: OnshapeClient,
    instancePath: InstancePath
): Promise<any> {
    return client.get(apiPath("metadata", instancePath, toInstanceApiPath), {
        query: { includeComputedProperties: "false" }
    });
}

export function getAllElementMetadata(
    client: OnshapeClient,
    instancePath: InstancePath
): Promise<any> {
    return client.get(
        apiPath("metadata", instancePath, toInstanceApiPath, { endRoute: "e" }),
        { query: { includeComputedProperties: "false" } }
    );
}

export function getElementMetadata(
    client: OnshapeClient,
    elementPath: ElementPath
): Promise<any> {
    return client.get(apiPath("metadata", elementPath, toElementApiPath), {
        query: { includeComputedProperties: "false" }
    });
}

export function updateElementMetadata(
    client: OnshapeClient,
    elementPath: ElementPath,
    propertyId: string,
    value: unknown
): Promise<any> {
    return client.post(apiPath("metadata", elementPath, toElementApiPath), {
        body: {
            jsonType: "metadata-element",
            properties: [{ propertyId, value }]
        }
    });
}

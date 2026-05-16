import { OnshapeApi } from "../client/onshape-api";
import {
  ElementPath,
  InstancePath,
  toElementApiPath,
  toInstanceApiPath,
} from "../../../shared/path";
import { apiPath } from "../api-path";

export function getInstanceMetadata(
  client: OnshapeApi,
  instancePath: InstancePath,
): Promise<any> {
  return client.get(apiPath("metadata", instancePath, toInstanceApiPath), {
    query: { includeComputedProperties: "false" },
  });
}

export function getAllElementMetadata(
  client: OnshapeApi,
  instancePath: InstancePath,
): Promise<any> {
  return client.get(
    apiPath("metadata", instancePath, toInstanceApiPath, { endRoute: "e" }),
    { query: { includeComputedProperties: "false" } },
  );
}

export function getElementMetadata(
  client: OnshapeApi,
  elementPath: ElementPath,
): Promise<any> {
  return client.get(apiPath("metadata", elementPath, toElementApiPath), {
    query: { includeComputedProperties: "false" },
  });
}

export function updateElementMetadata(
  client: OnshapeApi,
  elementPath: ElementPath,
  propertyId: string,
  value: unknown,
): Promise<any> {
  return client.post(apiPath("metadata", elementPath, toElementApiPath), {
    body: {
      jsonType: "metadata-element",
      properties: [{ propertyId, value }],
    },
  });
}

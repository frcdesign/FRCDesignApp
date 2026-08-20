import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-utils/api";
import { EMPTY_UNIT_INFO, type UnitInfo } from "../shared/configuration-models";
import { InstancePath } from "../shared/onshape-path";
import { unitInfoQueryKey } from "./query-keys";

/**
 * The current document's units. Disabled when not connected to a document, and
 * each quantity then falls back to its own unit.
 */
export function useUnitInfoQuery(instancePath: InstancePath, enabled = true) {
    return useQuery<UnitInfo>({
        queryKey: unitInfoQueryKey(instancePath),
        queryFn: () =>
            apiGet("/unit-info", {
                query: {
                    documentId: instancePath.documentId,
                    instanceId: instancePath.instanceId,
                    instanceType: instancePath.instanceType
                }
            }),
        enabled,
        placeholderData: EMPTY_UNIT_INFO
    });
}

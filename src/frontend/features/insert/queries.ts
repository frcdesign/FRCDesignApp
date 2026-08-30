import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import {
    type ConfigurationResult,
    type UnitInfo
} from "@backend/features/configurations/models";
import { InstancePath } from "@backend/lib/onshape/path";
import { configurationQueryKey, unitInfoQueryKey } from "../../lib/query-keys";
import { toInsertablePath } from "../library/library-path";

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
        enabled
    });
}

/**
 * An insertable's parameters and the records probed for them. Pinned to the
 * microversion, so it is never refetched under a user mid-configuration.
 */
export function useConfigurationQuery(
    insertableId: string,
    microversionId: string,
    enabled = true
) {
    return useQuery<ConfigurationResult>({
        queryKey: configurationQueryKey(insertableId, microversionId),
        queryFn: () =>
            apiGet("/configuration" + toInsertablePath(insertableId), {
                cacheId: microversionId
            }),
        enabled,
        refetchInterval: false
    });
}

import { useIsFetching, useMutation, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { apiGet, apiPost } from "../../lib/api-client";
import {
    type ConfigurationResult,
    Selection,
    type UnitInfo
} from "@backend/features/configurations/contract";
import {
    type ElementPath,
    InstancePath
} from "@backend/lib/onshape/path";
import {
    InsertableOut,
    type InsertOut
} from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { InsertSource } from "@backend/features/analytics/events";
import {
    showLoadingToast,
    showSuccessToast
} from "../../lib/notifications";
import { queryClient } from "../../lib/query-client";
import { getAppErrorHandler } from "../../lib/errors";
import { sendOpenFeatureMessage } from "../../lib/messages";
import { configurationQueryKey, unitInfoQueryKey } from "../../lib/query-keys";
import { toInsertablePath } from "../../lib/api-paths";

interface InsertArgs {
    /** Whether the part is favorited — see `source` for where the insert began. */
    isFavorite: boolean;
    source: InsertSource;
    isQuickInsert?: boolean;
}

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

/** Whether {@link useConfigurationQuery} is in flight for this insertable. */
export function useIsFetchingConfiguration(
    insertableId: string,
    microversionId: string
): boolean {
    return (
        useIsFetching({
            queryKey: configurationQueryKey(insertableId, microversionId)
        }) > 0
    );
}

export function useInsertMutation(
    insertable: InsertableOut,
    selection: Selection | undefined,
    insertArgs: InsertArgs
) {
    const search = useSearch({ from: "/app" });

    const toastId = "insert-" + insertable.id;

    return useMutation({
        mutationKey: ["insert", insertable.id],
        mutationFn: async (fasten: boolean) => {
            let endpoint: string;
            let body: Record<string, unknown>;

            // The tab being inserted into, sent whole so the instance type
            // travels with its id rather than being reassembled from the URL.
            const targetPath: ElementPath = {
                documentId: search.documentId,
                instanceId: search.instanceId,
                instanceType: search.instanceType,
                elementId: search.elementId
            };

            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
                body = {
                    targetPath,
                    selection,
                    isFavorite: insertArgs.isFavorite,
                    isQuickInsert: insertArgs.isQuickInsert ?? false,
                    source: insertArgs.source,
                    fasten,
                    elementType: insertable.elementType
                };
            } else {
                endpoint = "/add-to-part-studio";
                body = {
                    targetPath,
                    selection,
                    isFavorite: insertArgs.isFavorite,
                    isQuickInsert: insertArgs.isQuickInsert ?? false,
                    source: insertArgs.source,
                    useMateConnector: insertable.supportsFasten
                };
            }
            await queryClient.cancelQueries({ queryKey: ["thumbnail"] });

            showLoadingToast(`Inserting ${insertable.name}...`, toastId);
            return apiPost<InsertOut>(
                endpoint + toInsertablePath(insertable.id),
                { body }
            );
        },
        onError: getAppErrorHandler(
            `Unexpectedly failed to insert ${insertable.name}.`,
            toastId
        ),
        // On the mate that was built, not the one that was asked for: only the
        // assembly path builds one, and it answers with null when it did not.
        onSuccess: (result) => {
            if (result.featureId === null) {
                showSuccessToast(
                    `Successfully inserted ${insertable.name}.`,
                    toastId
                );
                return;
            }
            sendOpenFeatureMessage(search, result.featureId);
            showSuccessToast(
                `Successfully inserted ${insertable.name} and created a Fasten mate.`,
                toastId
            );
        }
    });
}

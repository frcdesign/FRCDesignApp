import {
    skipToken,
    useIsFetching,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api-client";
import {
    type ConfigurationResult,
    type PartialSelection,
    type UnitInfo
} from "@backend/features/configurations/contract";
import {
    InsertableOut,
    type InsertOut
} from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { InsertSource } from "@backend/features/analytics/usage";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { queryClient } from "../../lib/query-client";
import { getAppErrorHandler } from "../../lib/errors";
import { sendOpenFeatureMessage } from "../../lib/messages";
import { useTargetElement } from "../../lib/onshape-params";
import {
    configurationQueryKey,
    renderQueryPrefix,
    unitInfoQueryKey
} from "../../lib/query-keys";
import { toInsertablePath } from "../../lib/api-paths";
import { useInsertLocationId } from "../insert-location/queries";

interface InsertArgs {
    /** Whether the part is favorited — see `source` for where the insert began. */
    isFavorite: boolean;
    source: InsertSource;
    isQuickInsert?: boolean;
}

/** Undefined outside a document, or until they load; quantities show their own unit meanwhile. */
export function useUnitInfo(): UnitInfo | undefined {
    const target = useTargetElement();
    const query = useQuery<UnitInfo>({
        queryKey: unitInfoQueryKey(target),
        queryFn: target
            ? () =>
                  apiGet("/unit-info", {
                      query: {
                          documentId: target.documentId,
                          instanceId: target.instanceId,
                          instanceType: target.instanceType
                      }
                  })
            : skipToken,
        // A document's units do not change while it is open.
        staleTime: Infinity
    });
    return query.data;
}

/** Pinned to the microversion, so it never refetches mid-configuration. */
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
    /** Partial is fine: the server makes it whole. */
    selection: PartialSelection | undefined,
    insertArgs: InsertArgs
) {
    const target = useTargetElement();
    // The backend resolves where it is now, since it moves when dragged.
    const insertLocationId = useInsertLocationId();

    const toastId = "insert-" + insertable.id;

    const toRequest = (fasten: boolean) => {
        // Insert buttons don't render without a target.
        if (!target) {
            throw new Error("Nothing to insert into.");
        }
        const { elementType, ...targetPath } = target;
        const common = {
            targetPath,
            selection,
            isFavorite: insertArgs.isFavorite,
            isQuickInsert: insertArgs.isQuickInsert ?? false,
            source: insertArgs.source
        };
        return elementType === ElementType.ASSEMBLY
            ? {
                  endpoint: "/add-to-assembly",
                  body: { ...common, fasten, insertLocationId }
              }
            : {
                  endpoint: "/add-to-part-studio",
                  body: {
                      ...common,
                      useMateConnector: insertable.supportsFasten
                  }
              };
    };

    return useMutation({
        mutationKey: ["insert", insertable.id],
        mutationFn: async (fasten: boolean) => {
            const { endpoint, body } = toRequest(fasten);
            await queryClient.cancelQueries({ queryKey: renderQueryPrefix() });
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
        onSuccess: (result) => {
            if (target && result.featureId !== undefined) {
                sendOpenFeatureMessage(target, result.featureId);
            }
            // In an assembly, the only feature an insert builds is the mate.
            const fastened =
                result.featureId !== undefined &&
                target?.elementType === ElementType.ASSEMBLY;
            showSuccessToast(
                fastened
                    ? `Successfully inserted ${insertable.name} and created a Fasten mate.`
                    : `Successfully inserted ${insertable.name}.`,
                toastId
            );
        }
    });
}

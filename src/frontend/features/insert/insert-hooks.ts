import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { apiPost } from "../../lib/api-client";
import { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { type ElementPath } from "@backend/lib/onshape/path";
import { showLoadingToast, showSuccessToast } from "../../lib/notifications";
import { queryClient } from "../../lib/query-client";
import { getAppErrorHandler } from "../../lib/errors";
import { useMemo } from "react";
import { ParameterValues } from "@backend/features/configurations/models";
import { toInsertablePath } from "../library/library-path";
import { sendOpenFeatureMessage } from "../../lib/messages";

export interface InsertArgs {
    isFavorite: boolean;
    isQuickInsert?: boolean;
}

export function useInsertMutation(
    insertable: InsertableOut,
    configuration: ParameterValues | undefined,
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
                    configuration,
                    isFavorite: insertArgs.isFavorite,
                    isQuickInsert: insertArgs.isQuickInsert ?? false,
                    fasten,
                    elementType: insertable.elementType
                };
            } else {
                endpoint = "/add-to-part-studio";
                body = {
                    targetPath,
                    configuration,
                    isFavorite: insertArgs.isFavorite,
                    isQuickInsert: insertArgs.isQuickInsert ?? false,
                    useMateConnector: insertable.supportsFasten
                };
            }
            await queryClient.cancelQueries({ queryKey: ["thumbnail"] });

            showLoadingToast(`Inserting ${insertable.name}...`, toastId);
            return apiPost(endpoint + toInsertablePath(insertable.id), {
                body
            });
        },
        onError: getAppErrorHandler(
            `Unexpectedly failed to insert ${insertable.name}.`,
            toastId
        ),
        onSuccess: (result, fasten: boolean) => {
            if (fasten) {
                sendOpenFeatureMessage(search, result.featureId);
                showSuccessToast(
                    `Successfully inserted ${insertable.name} and created a Fasten mate.`,
                    toastId
                );
            } else {
                showSuccessToast(
                    `Successfully inserted ${insertable.name}.`,
                    toastId
                );
            }
        }
    });
}

export function useTargetElementType(): ElementType {
    const search = useSearch({ from: "/app" });
    return search.elementType;
}

export function useIsAssemblyInPartStudio(elementType: ElementType): boolean {
    const targetElementType = useTargetElementType();
    return useMemo(() => {
        return (
            elementType === ElementType.ASSEMBLY &&
            targetElementType === ElementType.PART_STUDIO
        );
    }, [elementType, targetElementType]);
}

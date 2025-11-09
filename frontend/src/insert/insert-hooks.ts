import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { apiPost } from "../api/api";
import { ElementObj, ElementType } from "../api/models";
import { toElementApiPath } from "../api/path";
import { showLoadingToast, showSuccessToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { getAppErrorHandler } from "../api/errors";
import { useMemo } from "react";
import { Configuration } from "./configuration-models";
import { toLibraryPath, useLibrary } from "../api/library";

/**
 * Creates a mutation for inserting an element.
 * @param onClick Callback function to call when the mutation is triggered.
 */
export function useInsertMutation(
    element: ElementObj,
    configuration: Configuration | undefined,
    isFavorite: boolean,
    isQuickInsert: boolean = false
) {
    const search = useSearch({ from: "/app" });
    const library = useLibrary();

    const toastId = "insert-" + element.id;

    return useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async () => {
            let endpoint;
            const body: Record<string, any> = {
                documentId: element.documentId,
                instanceType: element.instanceType,
                instanceId: element.instanceId,
                elementId: element.id,
                configuration,
                name: element.name,
                isFavorite,
                isQuickInsert,
                userId: search.userId
            };
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly" + toLibraryPath(library);
                body.elementType = element.elementType;
            } else {
                // Part studio derive also needs name and microversion id
                endpoint = "/add-to-part-studio" + toLibraryPath(library);
                body.microversionId = element.microversionId;
            }
            // Cancel any outstanding thumbnail queries
            queryClient.cancelQueries({ queryKey: ["thumbnail-id"] });
            queryClient.cancelQueries({ queryKey: ["thumbnail"] });

            showLoadingToast(`Inserting ${element.name}...`, toastId);
            return apiPost(endpoint + toElementApiPath(search), {
                body
            });
        },
        onError: getAppErrorHandler(
            `Failed to insert ${element.name}.`,
            toastId
        ),
        onSuccess: () => {
            showSuccessToast(`Successfully inserted ${element.name}.`, toastId);
        }
    });
}

export function useIsAssemblyInPartStudio(elementType: ElementType): boolean {
    const search = useSearch({ from: "/app" });
    return useMemo(() => {
        return (
            elementType === ElementType.ASSEMBLY &&
            search.elementType == ElementType.PART_STUDIO
        );
    }, [elementType, search.elementType]);
}

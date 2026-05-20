import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { apiPost } from "../api-utils/api";
import { ElementObj, ElementType } from "../api-utils/client-models";
import { toElementApiPath } from "../../shared/path";
import { showLoadingToast, showSuccessToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { getAppErrorHandler } from "../api-utils/errors";
import { useMemo } from "react";
import { Configuration } from "../configurations/configuration-models";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { sendOpenFeatureMessage } from "../api-utils/messages";

export interface InsertArgs {
    isFavorite: boolean;
    isQuickInsert?: boolean;
}

/**
 * Creates a mutation for inserting an element.
 * @param onClick Callback function to call when the mutation is triggered.
 */
export function useInsertMutation(
    element: ElementObj,
    configuration: Configuration | undefined,
    insertArgs: InsertArgs
) {
    const search = useSearch({ from: "/app" });
    const library = useLibrary();

    const toastId = "insert-" + element.id;

    return useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async (fasten: boolean) => {
            let endpoint;
            const body: Record<string, any> = {
                ...element.path,
                configuration,
                isFavorite: insertArgs.isFavorite,
                isQuickInsert: insertArgs.isQuickInsert ?? false
            };
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
                body.fasten = fasten;
            } else {
                // Part studio derive also needs name and microversion id
                endpoint = "/add-to-part-studio";
                body.microversionId = element.microversionId;
                body.name = element.name;
                // Always use mate connector if the element supports fasten
                body.useMateConnector = element.supportsFasten;
            }
            // Cancel any outstanding thumbnail queries
            queryClient.cancelQueries({ queryKey: ["thumbnail"] });

            showLoadingToast(`Inserting ${element.name}...`, toastId);
            return apiPost(
                endpoint + toLibraryPath(library) + toElementApiPath(search),
                {
                    body
                }
            );
        },
        onError: getAppErrorHandler(
            `Unexpectedly failed to insert ${element.name}.`,
            toastId
        ),
        onSuccess: (result, fasten: boolean) => {
            if (fasten) {
                sendOpenFeatureMessage(search, result.featureId);
                showSuccessToast(
                    `Successfully inserted ${element.name} and created a Fasten mate.`,
                    toastId
                );
            } else {
                showSuccessToast(
                    `Successfully inserted ${element.name}.`,
                    toastId
                );
            }
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

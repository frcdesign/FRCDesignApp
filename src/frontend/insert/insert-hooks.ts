import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { apiPost } from "../api-utils/api";
import { InsertableOut } from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import { toElementApiPath } from "../../shared/path";
import { showLoadingToast, showSuccessToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { getAppErrorHandler } from "../api-utils/errors";
import { useMemo } from "react";
import { Configuration } from "../../shared/configuration-models";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { sendOpenFeatureMessage } from "../api-utils/messages";

export interface InsertArgs {
    isFavorite: boolean;
    isQuickInsert?: boolean;
}

/**
 * Creates a mutation for inserting an insertable.
 */
export function useInsertMutation(
    insertable: InsertableOut,
    configuration: Configuration | undefined,
    insertArgs: InsertArgs
) {
    const search = useSearch({ from: "/app" });
    const library = useLibrary();

    const toastId = "insert-" + insertable.id;

    return useMutation({
        mutationKey: ["insert", insertable.id],
        mutationFn: async (fasten: boolean) => {
            let endpoint;
            const body: Record<string, any> = {
                ...insertable.path,
                configuration,
                isFavorite: insertArgs.isFavorite,
                isQuickInsert: insertArgs.isQuickInsert ?? false
            };
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
                body.fasten = fasten;
            } else {
                endpoint = "/add-to-part-studio";
                body.microversionId = insertable.microversionId;
                body.name = insertable.name;
                body.useMateConnector = insertable.supportsFasten;
            }
            await queryClient.cancelQueries({ queryKey: ["thumbnail"] });

            showLoadingToast(`Inserting ${insertable.name}...`, toastId);
            return apiPost(
                endpoint + toLibraryPath(library) + toElementApiPath(search),
                { body }
            );
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

export function useIsAssemblyInPartStudio(elementType: ElementType): boolean {
    const search = useSearch({ from: "/app" });
    return useMemo(() => {
        return (
            elementType === ElementType.ASSEMBLY &&
            search.elementType == ElementType.PART_STUDIO
        );
    }, [elementType, search.elementType]);
}

import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { InsertableOut } from "../../shared/api-models";
import { hasUserAccess } from "../../shared/types";
import { useMemo } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import {
    toInsertablePath,
    toLibraryPath,
    useLibrary
} from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import { libraryQueryMatchKey } from "../queries";

export function useSetVisibilityMutation(
    insertableIds: string[],
    isVisible: boolean
) {
    const library = useLibrary();
    const router = useRouter();

    return useMutation({
        mutationKey: ["set-element-visibility"],
        mutationFn: async () => {
            if (!isVisible) {
                const result = window.confirm(
                    "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?"
                );
                if (!result) {
                    showErrorToast("Cancelled hide operation.");
                    return;
                }
            }
            return apiPost("/set-element-visibility" + toLibraryPath(library), {
                body: {
                    insertableIds,
                    isVisible
                }
            });
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to modify visibility."
        ),
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });
}

/**
 * Returns true if the insertable should be hidden from the current user.
 * Note this is different from whether the insertable is visible since admins can always see hidden insertables.
 */
export function useIsInsertableHidden(insertable: InsertableOut): boolean {
    const loaderData = useLoaderData({ from: "/app" });
    return useMemo(() => {
        return (
            !insertable.isVisible &&
            hasUserAccess(loaderData.currentAccessLevel)
        );
    }, [insertable.isVisible, loaderData.currentAccessLevel]);
}

export function useReloadThumbnailMutation(id: string, isDocumentId: boolean) {
    const router = useRouter();

    const endpoint = isDocumentId
        ? `/reload-document-thumbnail/document/${id}`
        : "/reload-insertable-thumbnail" + toInsertablePath(id);

    return useMutation({
        mutationKey: ["thumbnail", "reload", id],
        mutationFn: async () => {
            return apiPost(endpoint);
        },
        onError: getAppErrorHandler("Unexpectedly failed to reload thumbnail."),
        onSuccess: () => {
            showSuccessToast("Successfully reloaded thumbnail.");
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });
}

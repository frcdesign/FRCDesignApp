import { useMutation } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { InsertableOut } from "../../shared/api-models";
import { hasUserAccess } from "../../shared/types";
import { useCallback, useMemo } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import {
    toInsertablePath,
    toLibraryPath,
    useLibraryId
} from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import { libraryQueryMatchKey } from "../queries";

export function useSetVisibilityMutation(
    insertableIds: string[],
    isVisible: boolean
) {
    const libraryId = useLibraryId();
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["set-element-visibility"],
        mutationFn: async () => {
            return apiPost(
                "/set-element-visibility" + toLibraryPath(libraryId),
                {
                    body: {
                        insertableIds,
                        isVisible
                    }
                }
            );
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

    // Hiding elements is destructive (it removes them from all users'
    // favorites), so confirm before mutating. Showing elements proceeds
    // immediately.
    const mutate = useCallback(() => {
        if (isVisible) {
            mutation.mutate();
            return;
        }
        modals.openConfirmModal({
            title: "Hide elements",
            children:
                "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?",
            labels: { confirm: "Hide", cancel: "Cancel" },
            confirmProps: { color: "red" },
            onConfirm: () => mutation.mutate(),
            onCancel: () => showErrorToast("Cancelled hide operation.")
        });
    }, [isVisible, mutation]);

    return { mutate };
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
            hasUserAccess(loaderData.accessData.currentAccessLevel)
        );
    }, [insertable.isVisible, loaderData.accessData.currentAccessLevel]);
}

export function useReloadThumbnailMutation(id: string, isGroup: boolean) {
    const router = useRouter();

    const endpoint = isGroup
        ? `/reload-group-thumbnail/group/${id}`
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

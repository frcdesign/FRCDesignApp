import { useMutation } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { InsertableOut } from "../../shared/api-models";
import { hasUserAccess } from "../../shared/types";
import { useCallback, useMemo } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/notifications";
import {
    toInsertablePath,
    toLibraryPath,
    useLibraryId
} from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import { contextDataQueryKey, libraryQueryMatchKey } from "../queries";

/**
 * Shared onSettled for admin mutations that change per-entity data: pull fresh
 * context + library data and re-run loaders so the UI reflects the change.
 */
function useRefreshLibraryOnSettled() {
    const router = useRouter();
    return async () => {
        await queryClient.refetchQueries({ queryKey: contextDataQueryKey() });
        await queryClient.invalidateQueries({
            queryKey: libraryQueryMatchKey()
        });
        void router.invalidate();
    };
}

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
        onSettled: async () => {
            await queryClient.refetchQueries({
                queryKey: contextDataQueryKey()
            });
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });

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

    return { mutate, isPending: mutation.isPending };
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
            await queryClient.refetchQueries({
                queryKey: contextDataQueryKey()
            });
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });
}

/** Toggles an insertable's "open composite" flag (part studios only). */
export function useToggleOpenCompositeMutation(
    insertableId: string,
    isOpenComposite: boolean
) {
    const onSettled = useRefreshLibraryOnSettled();
    return useMutation({
        mutationKey: ["toggle-open-composite", insertableId],
        mutationFn: () =>
            apiPost("/toggle-open-composite" + toInsertablePath(insertableId), {
                body: { isOpenComposite: !isOpenComposite }
            }),
        onError: getAppErrorHandler("Failed to update open composite setting."),
        onSettled
    });
}

/** Toggles an insertable's "insert and fasten" support. */
export function useToggleInsertAndFastenMutation(insertableId: string) {
    const onSettled = useRefreshLibraryOnSettled();
    return useMutation({
        mutationKey: ["toggle-insert-and-fasten", insertableId],
        mutationFn: (newValue: boolean) =>
            apiPost(
                "/toggle-insert-and-fasten" + toInsertablePath(insertableId),
                { body: { supportsFasten: newValue } }
            ),
        onSuccess: (_result, newValue: boolean) => {
            if (newValue) {
                showSuccessToast("Successfully enabled Insert and fasten.");
            }
        },
        onError: getAppErrorHandler("Failed to enable Insert and fasten."),
        onSettled
    });
}

/** Toggles whether an insertable's part numbers are indexed for search. */
export function useTogglePartNumberSearchMutation(insertableId: string) {
    const onSettled = useRefreshLibraryOnSettled();
    return useMutation({
        mutationKey: ["toggle-part-number-search", insertableId],
        mutationFn: (newValue: boolean) =>
            apiPost(
                "/toggle-part-number-search" + toInsertablePath(insertableId),
                { body: { searchPartNumbers: newValue } }
            ),
        onSuccess: (_result, newValue: boolean) => {
            if (newValue) {
                showSuccessToast("Successfully enabled part number search.");
            }
        },
        onError: getAppErrorHandler("Failed to update part number search."),
        onSettled
    });
}

/** Toggles a group between alphabetical and tab sort order. */
export function useToggleSortOrderMutation(
    groupId: string,
    groupName: string,
    sortAlphabetically: boolean
) {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["sort-group-alphabetically", groupId],
        mutationFn: async () =>
            apiPost("/sort-group-alphabetically" + toLibraryPath(libraryId), {
                body: { groupId, sortAlphabetically: !sortAlphabetically }
            }),
        onError: getAppErrorHandler(`Failed to update group ${groupName}.`),
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
    });
}

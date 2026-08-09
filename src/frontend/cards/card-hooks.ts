import { useMutation } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { InsertableOut, LibraryBuildStatus } from "../../shared/api-models";
import { hasUserAccess } from "../../shared/types";
import { useCallback, useMemo } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast
} from "../common/notifications";
import {
    toInsertablePath,
    toLibraryPath,
    useLibraryId
} from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import {
    buildStatusQueryKey,
    contextDataQueryKey,
    libraryQueryMatchKey
} from "../queries";
import { getQueryUpdater } from "../common/utils";

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

/** The build-status query key for the currently-viewed library. */
function useBuildStatusKey() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return buildStatusQueryKey(libraryId, cacheVersion);
}

interface OptimisticToggleConfig<TVars> {
    mutationKey: readonly unknown[];
    mutationFn: (vars: TVars) => Promise<unknown>;
    /** Optimistically applies the change to the cached build status. */
    apply: (status: LibraryBuildStatus, vars: TVars) => void;
    toastId: string;
    loadingMessage: (vars: TVars) => string;
    successMessage: (vars: TVars) => string;
    errorMessage: string;
}

/**
 * A mutation that optimistically flips a build-status flag, shows a
 * loading→success/error toast, and reverts on failure — so the admin switches
 * feel instant even when the underlying request is slow. Mirrors the optimistic
 * `onMutate`/rollback pattern used by `useSetGroupOrderMutation`.
 */
function useOptimisticToggleMutation<TVars>(
    config: OptimisticToggleConfig<TVars>
) {
    const onSettled = useRefreshLibraryOnSettled();
    const key = useBuildStatusKey();

    return useMutation({
        mutationKey: config.mutationKey,
        mutationFn: config.mutationFn,
        onMutate: async (vars: TVars) => {
            showLoadingToast(config.loadingMessage(vars), config.toastId);
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<LibraryBuildStatus>(key);
            queryClient.setQueryData(
                key,
                getQueryUpdater<LibraryBuildStatus>((status) =>
                    config.apply(status, vars)
                )
            );
            return { previous };
        },
        onSuccess: (_result, vars) => {
            showSuccessToast(config.successMessage(vars), config.toastId);
        },
        onError: (error: Error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            getAppErrorHandler(config.errorMessage, config.toastId)(error);
        },
        onSettled
    });
}

export function useSetVisibilityMutation(
    insertableIds: string[],
    isVisible: boolean
) {
    const libraryId = useLibraryId();
    const onSettled = useRefreshLibraryOnSettled();
    const key = useBuildStatusKey();

    const mutation = useMutation({
        mutationKey: ["set-element-visibility", ...insertableIds],
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
        onMutate: async () => {
            showLoadingToast(
                isVisible ? "Showing elements..." : "Hiding elements...",
                "set-visibility"
            );
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<LibraryBuildStatus>(key);
            queryClient.setQueryData(
                key,
                getQueryUpdater<LibraryBuildStatus>((status) => {
                    for (const id of insertableIds) {
                        const insertable = status.insertables[id];
                        if (insertable) insertable.isVisible = isVisible;
                    }
                })
            );
            return { previous };
        },
        onSuccess: () => {
            showSuccessToast(
                isVisible ? "Elements shown." : "Elements hidden.",
                "set-visibility"
            );
        },
        onError: (error: Error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            getAppErrorHandler(
                "Unexpectedly failed to modify visibility.",
                "set-visibility"
            )(error);
        },
        onSettled
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
export function useToggleOpenCompositeMutation(insertableId: string) {
    return useOptimisticToggleMutation<boolean>({
        mutationKey: ["toggle-open-composite", insertableId],
        mutationFn: (newValue) =>
            apiPost("/toggle-open-composite" + toInsertablePath(insertableId), {
                body: { isOpenComposite: newValue }
            }),
        apply: (status, newValue) => {
            const insertable = status.insertables[insertableId];
            if (insertable) insertable.isOpenComposite = newValue;
        },
        toastId: `open-composite-${insertableId}`,
        loadingMessage: (newValue) =>
            newValue
                ? "Setting open composite..."
                : "Removing open composite...",
        successMessage: (newValue) =>
            newValue ? "Set open composite." : "Removed open composite.",
        errorMessage: "Failed to update open composite setting."
    });
}

/** Toggles an insertable's "insert and fasten" support. */
export function useToggleInsertAndFastenMutation(insertableId: string) {
    return useOptimisticToggleMutation<boolean>({
        mutationKey: ["toggle-insert-and-fasten", insertableId],
        mutationFn: (newValue) =>
            apiPost(
                "/toggle-insert-and-fasten" + toInsertablePath(insertableId),
                { body: { supportsFasten: newValue } }
            ),
        apply: (status, newValue) => {
            const insertable = status.insertables[insertableId];
            if (insertable) insertable.supportsFasten = newValue;
        },
        toastId: `insert-and-fasten-${insertableId}`,
        loadingMessage: (newValue) =>
            newValue
                ? "Enabling insert and fasten..."
                : "Disabling insert and fasten...",
        successMessage: (newValue) =>
            newValue
                ? "Enabled insert and fasten."
                : "Disabled insert and fasten.",
        errorMessage: "Failed to update insert and fasten."
    });
}

/** Toggles whether an insertable's part numbers are indexed for search. */
export function useTogglePartNumberSearchMutation(insertableId: string) {
    return useOptimisticToggleMutation<boolean>({
        mutationKey: ["toggle-part-number-search", insertableId],
        mutationFn: (newValue) =>
            apiPost(
                "/toggle-part-number-search" + toInsertablePath(insertableId),
                { body: { searchPartNumbers: newValue } }
            ),
        apply: (status, newValue) => {
            const insertable = status.insertables[insertableId];
            if (insertable) insertable.searchPartNumbers = newValue;
        },
        toastId: `part-number-search-${insertableId}`,
        loadingMessage: (newValue) =>
            newValue
                ? "Enabling part number search..."
                : "Disabling part number search...",
        successMessage: (newValue) =>
            newValue
                ? "Enabled part number search."
                : "Disabled part number search.",
        errorMessage: "Failed to update part number search."
    });
}

/** Toggles a group between alphabetical and tab sort order. */
export function useToggleSortOrderMutation(groupId: string, groupName: string) {
    const libraryId = useLibraryId();
    return useOptimisticToggleMutation<boolean>({
        mutationKey: ["sort-group-alphabetically", groupId],
        mutationFn: async (newValue) =>
            apiPost("/sort-group-alphabetically" + toLibraryPath(libraryId), {
                body: { groupId, sortAlphabetically: newValue }
            }),
        apply: (status, newValue) => {
            const group = status.groups[groupId];
            if (group) group.sortAlphabetically = newValue;
        },
        toastId: `sort-order-${groupId}`,
        loadingMessage: (newValue) =>
            newValue
                ? "Sorting alphabetically..."
                : "Switching to tab order...",
        successMessage: (newValue) =>
            newValue ? "Sorted alphabetically." : "Using tab order.",
        errorMessage: `Failed to update group ${groupName}.`
    });
}

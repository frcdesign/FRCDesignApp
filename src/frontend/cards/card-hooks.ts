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

/**
 * Cancels in-flight build-status fetches and optimistically applies `recipe`,
 * returning the pre-patch snapshot to roll back to on error.
 */
async function patchBuildStatus(
    key: readonly unknown[],
    recipe: (status: LibraryBuildStatus) => void
): Promise<LibraryBuildStatus | undefined> {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<LibraryBuildStatus>(key);
    queryClient.setQueryData(key, getQueryUpdater<LibraryBuildStatus>(recipe));
    return previous;
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
            const previous = await patchBuildStatus(key, (status) => {
                for (const id of insertableIds) {
                    const insertable = status.insertables[id];
                    if (insertable) insertable.isVisible = isVisible;
                }
            });
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
    const key = useBuildStatusKey();
    const onSettled = useRefreshLibraryOnSettled();
    return useMutation({
        mutationKey: ["toggle-open-composite", insertableId],
        mutationFn: (isOpenComposite: boolean) =>
            apiPost("/toggle-open-composite" + toInsertablePath(insertableId), {
                body: { isOpenComposite }
            }),
        onMutate: async (isOpenComposite) => {
            const previous = await patchBuildStatus(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable) insertable.isOpenComposite = isOpenComposite;
            });
            return { previous };
        },
        onSuccess: (_result, isOpenComposite) =>
            showSuccessToast(
                isOpenComposite
                    ? "Set open composite."
                    : "Removed open composite."
            ),
        onError: (error: Error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            getAppErrorHandler("Unexpectedly failed to update open composite.")(
                error
            );
        },
        onSettled
    });
}

/** Toggles an insertable's "insert and fasten" support (a slow Onshape call). */
export function useToggleInsertAndFastenMutation(insertableId: string) {
    const key = useBuildStatusKey();
    const onSettled = useRefreshLibraryOnSettled();
    const toastId = `insert-and-fasten-${insertableId}`;
    return useMutation({
        mutationKey: ["toggle-insert-and-fasten", insertableId],
        mutationFn: (supportsFasten: boolean) =>
            apiPost(
                "/toggle-insert-and-fasten" + toInsertablePath(insertableId),
                { body: { supportsFasten } }
            ),
        onMutate: async (supportsFasten) => {
            showLoadingToast(
                supportsFasten
                    ? "Enabling insert and fasten..."
                    : "Disabling insert and fasten...",
                toastId
            );
            const previous = await patchBuildStatus(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable) insertable.supportsFasten = supportsFasten;
            });
            return { previous };
        },
        onSuccess: (_result, supportsFasten) =>
            showSuccessToast(
                supportsFasten
                    ? "Enabled insert and fasten."
                    : "Disabled insert and fasten.",
                toastId
            ),
        onError: (error: Error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            getAppErrorHandler(
                "Unexpectedly failed to update insert and fasten.",
                toastId
            )(error);
        },
        onSettled
    });
}

/** Toggles part-number search indexing for an insertable (a slow Onshape call). */
export function useTogglePartNumberSearchMutation(insertableId: string) {
    const key = useBuildStatusKey();
    const onSettled = useRefreshLibraryOnSettled();
    const toastId = `part-number-search-${insertableId}`;
    return useMutation({
        mutationKey: ["toggle-part-number-search", insertableId],
        mutationFn: (searchPartNumbers: boolean) =>
            apiPost(
                "/toggle-part-number-search" + toInsertablePath(insertableId),
                { body: { searchPartNumbers } }
            ),
        onMutate: async (searchPartNumbers) => {
            showLoadingToast(
                searchPartNumbers
                    ? "Enabling part number search..."
                    : "Disabling part number search...",
                toastId
            );
            const previous = await patchBuildStatus(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable)
                    insertable.searchPartNumbers = searchPartNumbers;
            });
            return { previous };
        },
        onSuccess: (_result, searchPartNumbers) =>
            showSuccessToast(
                searchPartNumbers
                    ? "Enabled part number search."
                    : "Disabled part number search.",
                toastId
            ),
        onError: (error: Error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            getAppErrorHandler(
                "Unexpectedly failed to update part number search.",
                toastId
            )(error);
        },
        onSettled
    });
}

/** Toggles a group between alphabetical and tab sort order. */
export function useToggleSortOrderMutation(groupId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const onSettled = useRefreshLibraryOnSettled();
    return useMutation({
        mutationKey: ["sort-group-alphabetically", groupId],
        mutationFn: (sortAlphabetically: boolean) =>
            apiPost("/sort-group-alphabetically" + toLibraryPath(libraryId), {
                body: { groupId, sortAlphabetically }
            }),
        onMutate: async (sortAlphabetically) => {
            const previous = await patchBuildStatus(key, (status) => {
                const group = status.groups[groupId];
                if (group) group.sortAlphabetically = sortAlphabetically;
            });
            return { previous };
        },
        onSuccess: (_result, sortAlphabetically) =>
            showSuccessToast(
                sortAlphabetically
                    ? "Sorted alphabetically."
                    : "Using tab order."
            ),
        onError: (error: Error, _vars, context) => {
            queryClient.setQueryData(key, context?.previous);
            getAppErrorHandler("Unexpectedly failed to update sort order.")(
                error
            );
        },
        onSettled
    });
}

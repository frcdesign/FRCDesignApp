import { useMutation } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { apiPost } from "../api-utils/api";
import { InsertableOut, LibraryBuildStatus } from "../../shared/api-models";
import { hasUserAccess } from "../../shared/types";
import { useCallback, useMemo } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast
} from "../common/notifications";
import {
    toInsertablePath,
    toLibraryPath,
    useCacheVersion,
    useLibraryId
} from "../api-utils/library";
import { getAppErrorHandler } from "../api-utils/errors";
import { buildStatusQueryKey } from "../queries";
import { useRefreshLibrary } from "../api-utils/refresh";
import { patchQuery } from "../common/utils";
import { useCloseBuildCard } from "./build-status";

/** The build-status query key for the currently-viewed library. */
function useBuildStatusKey() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return buildStatusQueryKey(libraryId, cacheVersion);
}

export function useSetVisibilityMutation(
    insertableIds: string[],
    isVisible: boolean
) {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    const key = useBuildStatusKey();

    const closeCard = useCloseBuildCard();

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
        onMutate: () => {
            showLoadingToast(
                isVisible ? "Showing insertables..." : "Hiding insertables...",
                "set-visibility"
            );
            return patchQuery<LibraryBuildStatus>(key, (status) => {
                for (const id of insertableIds) {
                    const insertable = status.insertables[id];
                    if (insertable) insertable.isVisible = isVisible;
                }
            });
        },
        onSuccess: () => {
            showSuccessToast(
                isVisible ? "Insertables shown." : "Insertables hidden.",
                "set-visibility"
            );
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to modify visibility.",
            "set-visibility"
        ),
        onSettled: refreshLibrary
    });

    const mutate = useCallback(() => {
        if (isVisible) {
            mutation.mutate();
            return;
        }
        closeCard();
        modals.openConfirmModal({
            title: "Hide elements",
            children:
                "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?",
            labels: { confirm: "Hide", cancel: "Cancel" },
            confirmProps: { color: "red" },
            onConfirm: () => mutation.mutate(),
            onCancel: () => showErrorToast("Cancelled hide operation.")
        });
    }, [isVisible, closeCard, mutation]);

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
    const refreshLibrary = useRefreshLibrary();

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
        onSettled: refreshLibrary
    });
}

/** Toggles an insertable's "insert and fasten" support (a slow Onshape call). */
export function useToggleInsertAndFastenMutation(insertableId: string) {
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    const toastId = `insert-and-fasten-${insertableId}`;
    return useMutation({
        mutationKey: ["toggle-insert-and-fasten", insertableId],
        mutationFn: (supportsFasten: boolean) =>
            apiPost(
                "/toggle-insert-and-fasten" + toInsertablePath(insertableId),
                { body: { supportsFasten } }
            ),
        onMutate: (supportsFasten) => {
            showLoadingToast(
                supportsFasten
                    ? "Enabling insert and fasten..."
                    : "Disabling insert and fasten...",
                toastId
            );
            return patchQuery<LibraryBuildStatus>(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable) insertable.supportsFasten = supportsFasten;
            });
        },
        onSuccess: (_result, supportsFasten) =>
            showSuccessToast(
                supportsFasten
                    ? "Enabled insert and fasten."
                    : "Disabled insert and fasten.",
                toastId
            ),
        onError: getAppErrorHandler(
            "Failed to enable insert and fasten. Is the target valid?",
            toastId
        ),
        onSettled: refreshLibrary
    });
}

/** Toggles part-number search indexing for an insertable (a slow Onshape call). */
export function useTogglePartNumberSearchMutation(insertableId: string) {
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    const toastId = `part-number-search-${insertableId}`;
    return useMutation({
        mutationKey: ["toggle-part-number-search", insertableId],
        mutationFn: (searchPartNumbers: boolean) =>
            apiPost(
                "/toggle-part-number-search" + toInsertablePath(insertableId),
                { body: { searchPartNumbers } }
            ),
        onMutate: (searchPartNumbers) => {
            showLoadingToast(
                searchPartNumbers
                    ? "Enabling part number search..."
                    : "Disabling part number search...",
                toastId
            );
            return patchQuery<LibraryBuildStatus>(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable)
                    insertable.searchPartNumbers = searchPartNumbers;
            });
        },
        onSuccess: (_result, searchPartNumbers) =>
            showSuccessToast(
                searchPartNumbers
                    ? "Enabled part number search."
                    : "Disabled part number search.",
                toastId
            ),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update part number search.",
            toastId
        ),
        onSettled: refreshLibrary
    });
}

/** Toggles a group between alphabetical and tab sort order. */
export function useToggleSortOrderMutation(groupId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    return useMutation({
        mutationKey: ["sort-group-alphabetically", groupId],
        mutationFn: (sortAlphabetically: boolean) =>
            apiPost("/sort-group-alphabetically" + toLibraryPath(libraryId), {
                body: { groupId, sortAlphabetically }
            }),
        onMutate: (sortAlphabetically) =>
            patchQuery<LibraryBuildStatus>(key, (status) => {
                const group = status.groups[groupId];
                if (group) group.sortAlphabetically = sortAlphabetically;
            }),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update sort order."
        ),
        onSettled: refreshLibrary
    });
}

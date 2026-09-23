import {
    keepPreviousData,
    queryOptions,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api-client";
import { modals } from "@mantine/modals";
import { useCallback } from "react";
import {
    showInfoToast,
    showLoadingToast,
    showSuccessToast
} from "../../lib/notifications";
import { getAppErrorHandler } from "../../lib/errors";
import { patchQuery } from "../../lib/query-cache";
import { useRefreshLibrary } from "../../lib/refresh";
import { toInsertablePath, toLibraryPath } from "../../lib/api-paths";
import { useCloseHoverCard } from "../../components/app-hover-card";
import { type LibraryBuildStatus } from "@backend/features/build-checker/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { useLibraryId } from "../../lib/library";
import { useCacheVersion } from "../library/queries";
import { buildStatusQueryKey } from "../../lib/query-keys";

function getBuildStatusQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryBuildStatus>({
        queryKey: buildStatusQueryKey(libraryId, cacheVersion),
        queryFn: () =>
            apiGet("/build-status/library/" + libraryId, {
                cacheId: cacheVersion
            }),
        // A toggle bumps cacheVersion (and thus this key); keep the old data on
        // screen while the new version refetches so the hover card doesn't close.
        placeholderData: keepPreviousData,
        staleTime: Infinity,
        gcTime: Infinity
    });
}

/** The build-status query key for the currently-viewed library. */
function useBuildStatusKey() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return buildStatusQueryKey(libraryId, cacheVersion);
}

export function useBuildStatusQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return useQuery(getBuildStatusQuery(libraryId, cacheVersion));
}

export function useSetVisibilityMutation(
    insertableIds: string[],
    isVisible: boolean
) {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    const key = useBuildStatusKey();

    const closeCard = useCloseHoverCard();

    const mutation = useMutation({
        mutationKey: ["set-insertable-visibility", ...insertableIds],
        mutationFn: async () => {
            return apiPost(
                "/set-insertable-visibility" + toLibraryPath(libraryId),
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
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
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
            onConfirm: () => mutation.mutate()
        });
    }, [isVisible, closeCard, mutation]);

    return { mutate, isPending: mutation.isPending };
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
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

/**
 * Toggles indexing for an insertable. The Onshape call behind it
 * runs long, so the toast reports the switch rather than sitting on the response.
 */
export function useIndexConfigurationsMutation(insertableId: string) {
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    const toastId = `index-configurations-${insertableId}`;
    return useMutation({
        mutationKey: ["index-configurations", insertableId],
        mutationFn: (indexConfigurations: boolean) =>
            apiPost("/index-configurations" + toInsertablePath(insertableId), {
                body: { indexConfigurations }
            }),
        onMutate: (indexConfigurations) => {
            showInfoToast(
                indexConfigurations
                    ? "Enabling indexing"
                    : "Disabling indexing",
                { id: toastId }
            );
            return patchQuery<LibraryBuildStatus>(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable)
                    insertable.indexConfigurations = indexConfigurations;
            });
        },
        onSuccess: (_result, indexConfigurations) =>
            showSuccessToast(
                indexConfigurations
                    ? "Indexing enabled."
                    : "Indexing disabled.",
                toastId
            ),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update indexing.",
            toastId
        ),
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

/**
 * Sets which of a part studio's parameters indexing leaves out. Re-probes the
 * part like toggling indexing does, so the toast reports the change first.
 */
export function useExcludedParametersMutation(insertableId: string) {
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    const toastId = `excluded-parameters-${insertableId}`;
    return useMutation({
        mutationKey: ["excluded-parameters", insertableId],
        mutationFn: (excludedParameterIds: string[]) =>
            apiPost("/excluded-parameters" + toInsertablePath(insertableId), {
                body: { excludedParameterIds }
            }),
        onMutate: (excludedParameterIds) => {
            showInfoToast("Reindexing part", { id: toastId });
            return patchQuery<LibraryBuildStatus>(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable)
                    insertable.excludedParameterIds = excludedParameterIds;
            });
        },
        onSuccess: () => showSuccessToast("Part reindexed.", toastId),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update the indexed parameters.",
            toastId
        ),
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
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
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

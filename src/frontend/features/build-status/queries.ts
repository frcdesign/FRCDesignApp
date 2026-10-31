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
        // So the hover card doesn't close while the new version loads.
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

/** How many documents have a new version waiting for an editor's approval. */
export function useHeldGroupCount(): number {
    const { data } = useBuildStatusQuery();
    return Object.values(data?.groups ?? {}).filter((group) => group.isHeld)
        .length;
}

export function useSetVisibilityMutation(
    insertableIds: string[],
    isVisible: boolean
) {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    const key = useBuildStatusKey();

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
        modals.openConfirmModal({
            title: "Hide elements",
            children:
                "You are about to hide one or more elements. This will also permanently remove them from all users' favorites. Are you sure?",
            labels: { confirm: "Hide", cancel: "Cancel" },
            confirmProps: { color: "red" },
            onConfirm: () => mutation.mutate()
        });
    }, [isVisible, mutation]);

    return { mutate, isPending: mutation.isPending };
}

/** Toggles an insertable's "insert and fasten" support (a slow Onshape call). */
export function useToggleInsertAndFastenMutation(insertableId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    const toastId = `insert-and-fasten-${insertableId}`;
    return useMutation({
        mutationKey: ["toggle-insert-and-fasten", insertableId],
        mutationFn: (supportsFasten: boolean) =>
            apiPost(
                "/toggle-insert-and-fasten" +
                    toLibraryPath(libraryId) +
                    toInsertablePath(insertableId),
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
            "Unexpectedly failed to update insert and fasten.",
            toastId
        ),
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

/** What an admin changed about indexing; a field left out keeps what is stored. */
export interface IndexingChange {
    indexConfigurations?: boolean;
    excludedParameterIds?: string[];
}

/** Every change lands in one reindex, so the toast reports it before Onshape answers. */
export function useIndexingMutation(insertableId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    const toastId = `indexing-${insertableId}`;
    return useMutation({
        mutationKey: ["indexing", insertableId],
        mutationFn: (change: IndexingChange) =>
            apiPost(
                "/indexing" +
                    toLibraryPath(libraryId) +
                    toInsertablePath(insertableId),
                { body: change }
            ),
        onMutate: (change) => {
            showInfoToast("Reindexing...", { id: toastId });
            return patchQuery<LibraryBuildStatus>(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (!insertable) return;
                if (change.indexConfigurations !== undefined)
                    insertable.indexConfigurations = change.indexConfigurations;
                if (change.excludedParameterIds !== undefined)
                    insertable.excludedParameterIds =
                        change.excludedParameterIds;
            });
        },
        onSuccess: () => showSuccessToast("Reindexed.", toastId),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update indexing.",
            toastId
        ),
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

/** A part studio grouped on insert, so its parts move as one. */
export function useInsertAsRigidMutation(insertableId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const refreshLibrary = useRefreshLibrary();
    return useMutation({
        mutationKey: ["insert-as-rigid", insertableId],
        mutationFn: (insertAsRigid: boolean) =>
            apiPost(
                "/insert-as-rigid" +
                    toLibraryPath(libraryId) +
                    toInsertablePath(insertableId),
                { body: { insertAsRigid } }
            ),
        onMutate: (insertAsRigid) =>
            patchQuery<LibraryBuildStatus>(key, (status) => {
                const insertable = status.insertables[insertableId];
                if (insertable) insertable.insertAsRigid = insertAsRigid;
            }),
        onError: getAppErrorHandler(
            "Unexpectedly failed to update insert as rigid."
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

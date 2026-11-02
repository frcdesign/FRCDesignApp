import {
    keepPreviousData,
    type QueryKey,
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
import type {
    IndexingSettings,
    InsertableBuildStatus,
    LibraryBuildStatus
} from "@backend/features/build-checker/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { useLibraryId } from "../../lib/library";
import { useCacheVersion } from "../library/queries";
import { buildStatusQueryKey } from "../../lib/query-keys";
import { m } from "../../paraglide/messages";

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

/** Patches one insertable in place; the refresh that settles each mutation is the undo. */
function patchInsertable(
    key: QueryKey,
    insertableId: string,
    recipe: (insertable: InsertableBuildStatus) => void
): Promise<void> {
    return patchQuery<LibraryBuildStatus>(key, (status) => {
        const insertable = status.insertables[insertableId];
        if (insertable) recipe(insertable);
    });
}

/** Every build-status mutation's `onSettled`: refetch, dropping the patch if it failed. */
function useSettleBuildStatus() {
    const refreshLibrary = useRefreshLibrary();
    return (_result: unknown, error: Error | null) =>
        refreshLibrary({ discardPatches: error !== null });
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
    const key = useBuildStatusKey();
    const settle = useSettleBuildStatus();
    const count = insertableIds.length;

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
                isVisible
                    ? m.adminCardShowing({ count })
                    : m.adminCardHiding({ count }),
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
                isVisible
                    ? m.adminCardShown({ count })
                    : m.adminCardHidden({ count }),
                "set-visibility"
            );
        },
        onError: getAppErrorHandler(
            m.adminCardVisibilityFailed(),
            "set-visibility"
        ),
        onSettled: settle
    });

    const mutate = useCallback(() => {
        if (isVisible) {
            mutation.mutate();
            return;
        }
        modals.openConfirmModal({
            title: m.adminCardHideTitle(),
            children: m.adminCardHideBody(),
            labels: {
                confirm: m.adminCardHideConfirm(),
                cancel: m.adminCardHideCancel()
            },
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
    const settle = useSettleBuildStatus();
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
                    ? m.adminCardEnablingFasten()
                    : m.adminCardDisablingFasten(),
                toastId
            );
            return patchInsertable(key, insertableId, (insertable) => {
                insertable.supportsFasten = supportsFasten;
                insertable.fastenDisabled = !supportsFasten;
            });
        },
        onSuccess: (_result, supportsFasten) =>
            showSuccessToast(
                supportsFasten
                    ? m.adminCardEnabledFasten()
                    : m.adminCardDisabledFasten(),
                toastId
            ),
        onError: getAppErrorHandler(m.adminCardFastenFailed(), toastId),
        onSettled: settle
    });
}

/** Every edit lands in one reindex, so the toast reports it before Onshape answers. */
export function useIndexingMutation(insertableId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const settle = useSettleBuildStatus();
    const toastId = `indexing-${insertableId}`;
    return useMutation({
        mutationKey: ["indexing", insertableId],
        mutationFn: (settings: IndexingSettings) =>
            apiPost(
                "/indexing" +
                    toLibraryPath(libraryId) +
                    toInsertablePath(insertableId),
                { body: settings }
            ),
        onMutate: (settings) => {
            showInfoToast(m.adminCardReindexing(), { id: toastId });
            return patchInsertable(key, insertableId, (insertable) => {
                Object.assign(insertable, settings);
            });
        },
        onSuccess: () => showSuccessToast(m.adminCardReindexed(), toastId),
        onError: getAppErrorHandler(m.adminCardIndexingFailed(), toastId),
        onSettled: settle
    });
}

/** Toggles a group between alphabetical and tab sort order. */
export function useToggleSortOrderMutation(groupId: string) {
    const libraryId = useLibraryId();
    const key = useBuildStatusKey();
    const settle = useSettleBuildStatus();
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
        onError: getAppErrorHandler(m.adminCardSortFailed()),
        onSettled: settle
    });
}

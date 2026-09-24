/** Reads and writes of the library: its snapshot, cache version and load jobs. */
import {
    keepPreviousData,
    queryOptions,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "../../lib/api-client";
import { type LibraryOut } from "@backend/features/library/contract";
import { type JobStatus } from "@backend/features/load/contract";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { useAccessData } from "../auth/access-level";
import { toLibraryPath } from "../../lib/api-paths";
import { useLibraryId } from "../../lib/library";
import {
    jobStatusQueryKey,
    libraryDataQueryKey,
    libraryVersionQueryKey
} from "../../lib/query-keys";
import { queryClient } from "../../lib/query-client";
import { getQueryUpdater } from "../../lib/query-cache";
import {
    showErrorToast,
    showInfoToast,
    showLoadingToast,
    showSuccessToast
} from "../../lib/notifications";
import { getAppErrorHandler, appError } from "../../lib/errors";
import { modals } from "@mantine/modals";
import { parseOnshapeDocumentId } from "../../lib/url";
import { useRefreshLibrary } from "../../lib/refresh";

export function getLibraryQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryOut>({
        queryKey: libraryDataQueryKey(libraryId, cacheVersion),
        queryFn: async () =>
            apiGet("/library-data/library/" + libraryId, {
                cacheId: cacheVersion
            }),
        // An admin change bumps cacheVersion (and thus this key); keep the old
        // snapshot on screen while the new one loads, so an edit reads as a
        // merge rather than dropping the whole list back to a spinner.
        placeholderData: keepPreviousData,
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useLibraryQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return useQuery(getLibraryQuery(libraryId, cacheVersion));
}

/** A library's cache version, which keys the `?v=` on every request for it. */
export function getLibraryVersionQuery(libraryId: LibraryId) {
    return queryOptions<number>({
        queryKey: libraryVersionQueryKey(libraryId),
        queryFn: () =>
            apiGet<{ version: number }>(
                "/library-version" + toLibraryPath(libraryId)
            ).then((result) => result.version),
        // Bumps arrive through the explicit refresh flows, which refetch this.
        staleTime: Infinity
    });
}

/** The displayed library's cache version, which keys its immutable responses. */
export function useCacheVersion(): number {
    const libraryId = useLibraryId();
    // Loaded by the library route before anything reading this renders.
    const versionQuery = useQuery(getLibraryVersionQuery(libraryId));
    return versionQuery.data ?? 0;
}

/**
 * Checked once on load, then kept current by the server's pushes. `canAsk` is
 * the caller's gate: the route is editor-only.
 */
function getJobStatusQuery(libraryId: LibraryId, canAsk: boolean) {
    return queryOptions<JobStatus>({
        queryKey: jobStatusQueryKey(libraryId),
        queryFn: () => apiGet("/job-status/library/" + libraryId),
        enabled: canAsk,
        // Every status badge observes this, so rows mounting as the user
        // scrolls would each trigger a fetch. Only a push should change it.
        staleTime: Infinity
    });
}

const NOTHING_LOADING: string[] = [];

/**
 * The groups loading in the library on screen. The endpoint is editor-only and
 * needs an Onshape session, so callers who have neither see none.
 */
function useLoadingGroupIds(): string[] {
    const libraryId = useLibraryId();
    const { signedIn, currentAccessLevel } = useAccessData();
    const query = useQuery(
        getJobStatusQuery(
            libraryId,
            signedIn && hasEditorAccess(currentAccessLevel)
        )
    );
    return query.data?.loadingGroupIds ?? NOTHING_LOADING;
}

/** Whether anything in the library is loading. */
export function useIsJobRunning(): boolean {
    return useLoadingGroupIds().length > 0;
}

/** Whether this group is loading, which its row and its parts show. */
export function useIsGroupLoading(groupId: string): boolean {
    return useLoadingGroupIds().includes(groupId);
}

/** Deleting cascades to insertables and their favorites. */
export function useDeleteGroupMutation(groupId: string) {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    return useMutation({
        mutationKey: ["delete-group", groupId],
        mutationFn: async () =>
            apiDelete("/group" + toLibraryPath(libraryId), {
                query: { groupId }
            }),
        // Refresh the whole view, not just the library list.
        onSuccess: () => refreshLibrary()
    });
}

export function useSetGroupOrderMutation() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    const refreshLibrary = useRefreshLibrary();
    const key = libraryDataQueryKey(libraryId, cacheVersion);

    return useMutation({
        mutationKey: ["group-order"],
        mutationFn: async (groupOrder: string[]) =>
            apiPost("/group-order" + toLibraryPath(libraryId), {
                body: { groupOrder }
            }),
        onMutate: async (newOrder: string[]) => {
            await queryClient.cancelQueries({ queryKey: key });
            queryClient.setQueryData(
                key,
                getQueryUpdater((data: LibraryOut) => {
                    data.groupOrder = newOrder;
                    return data;
                })
            );
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder group.");
        },
        // The bump reconciles it; a failure bumps nothing, so the patch has to
        // be dropped explicitly.
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

/** Force reloads every document in every library; the owner's alone. */
export function useReloadAllMutation() {
    return useMutation({
        mutationKey: ["reload-all"],
        mutationFn: (): Promise<{ documents: number }> =>
            apiPost("/reload-all"),
        onError: getAppErrorHandler("Failed to reload documents!"),
        onSuccess: (data) => {
            showInfoToast(`Reloading ${data.documents} documents...`);
        }
    });
}

/** Adds an Onshape document to the library, by its url. */
export function useAddGroupMutation(selectedGroupId?: string) {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["add-group", libraryId],
        mutationFn: async (url: string) => {
            const newDocumentId = parseOnshapeDocumentId(url);
            if (!newDocumentId) {
                throw appError("Failed to parse url.");
            }
            showLoadingToast("Adding document...", "add-group");
            modals.closeAll();
            return apiPost("/group" + toLibraryPath(libraryId), {
                body: { newDocumentId, selectedGroupId }
            });
        },
        onError: getAppErrorHandler(
            "Failed to add document. Make sure the document is valid.",
            "add-group"
        ),
        onSuccess: () => {
            showInfoToast("Adding document...", { id: "add-group" });
        }
    });
}

/**
 * Asks Onshape for one thumbnail again. A load does not wait for thumbnails,
 * so one that was not there at the time stays missing until the whole document
 * is reloaded; this is how to ask for just the one.
 */
export function useReloadThumbnailMutation(
    target: { groupId: string } | { insertableId: string }
) {
    const refreshLibrary = useRefreshLibrary();
    return useMutation({
        mutationKey: ["reload-thumbnail", target],
        mutationFn: async () => {
            showLoadingToast("Reloading thumbnail...", "reload-thumbnail");
            return apiPost("/reload-thumbnail", { body: target });
        },
        onError: getAppErrorHandler(
            "Failed to reload thumbnail. Onshape may not have one yet.",
            "reload-thumbnail"
        ),
        onSuccess: async () => {
            showSuccessToast("Thumbnail reloaded.", "reload-thumbnail");
            await refreshLibrary();
        }
    });
}

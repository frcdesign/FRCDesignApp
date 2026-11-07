/** Reads and writes of the library: its snapshot, cache version and load jobs. */
import {
    keepPreviousData,
    queryOptions,
    skipToken,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "../../lib/api-client";
import { type LibraryOut } from "@backend/features/library/contract";
import type {
    UpdateReferencesOut,
    WorkspaceChangesOut
} from "@backend/features/version-manager/contract";
import {
    type ApproveVersionsOut,
    type HoldNewVersionsOut,
    type JobStatus,
    type ReloadOut
} from "@backend/features/load/contract";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { useAccessData, useIsSignedIn } from "../auth/access-level";
import { toLibraryPath } from "../../lib/api-paths";
import { useLibraryId } from "../../lib/library";
import {
    documentChangesQueryKey,
    holdNewVersionsQueryKey,
    jobStatusQueryKey,
    libraryDataQueryKey,
    libraryVersionQueryKey
} from "../../lib/query-keys";
import { queryClient } from "../../lib/query-client";
import { getQueryUpdater } from "../../lib/query-cache";
import {
    showInfoToast,
    showLoadingToast,
    showSuccessToast
} from "../../lib/notifications";
import {
    getAppErrorHandler,
    appError,
    handleAppError,
    showReportableErrorToast
} from "../../lib/errors";
import { m } from "../../paraglide/messages";
import { modals } from "@mantine/modals";
import {
    INVALID_DOCUMENT_URL,
    parseOnshapeDocumentId
} from "../../lib/onshape-url";
import { useRefreshLibrary } from "../../lib/refresh";

/** The server answers from KV, so a minute only bounds how often a page of cards asks. */
const DOCUMENT_CHANGES_STALE_TIME = 60 * 1000;

/**
 * How far a group's document has moved in its default workspace since its last
 * version; with `includeElements`, each tab's microversion there too.
 */
export function useDocumentChangesQuery(
    documentId: string,
    includeElements: boolean
) {
    const libraryId = useLibraryId();
    const isSignedIn = useIsSignedIn();
    return useQuery<WorkspaceChangesOut>({
        queryKey: documentChangesQueryKey(
            libraryId,
            documentId,
            includeElements
        ),
        queryFn: isSignedIn
            ? () =>
                  apiGet("/workspace-changes", {
                      query: { documentId, elements: includeElements }
                  })
            : skipToken,
        staleTime: DOCUMENT_CHANGES_STALE_TIME
    });
}

export function getLibraryQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryOut>({
        queryKey: libraryDataQueryKey(libraryId, cacheVersion),
        queryFn: async () =>
            apiGet("/library-data/library/" + libraryId, {
                cacheId: cacheVersion
            }),
        // Keeps the old list up while an edit's new version loads.
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

/** Kept current by pushes after the first fetch. The route is editor-only. */
function getJobStatusQuery(libraryId: LibraryId, canAsk: boolean) {
    return queryOptions<JobStatus>({
        queryKey: jobStatusQueryKey(libraryId),
        queryFn: () => apiGet("/job-status/library/" + libraryId),
        enabled: canAsk,
        // Every status badge observes this; only a push should change it.
        staleTime: Infinity
    });
}

const NO_JOBS: JobStatus = { loadingGroupIds: [] };

/** Empty for callers who aren't editors with an Onshape session. */
function useJobStatus(): JobStatus {
    const libraryId = useLibraryId();
    const { signedIn, currentAccessLevel } = useAccessData();
    const query = useQuery(
        getJobStatusQuery(
            libraryId,
            signedIn && hasEditorAccess(currentAccessLevel)
        )
    );
    return query.data ?? NO_JOBS;
}

function useLoadingGroupIds(): string[] {
    return useJobStatus().loadingGroupIds;
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
        onError: (error) => {
            showReportableErrorToast(m.libraryReorderGroupFailed(), error);
        },
        // A failure bumps nothing, so the patch has to be dropped explicitly.
        onSettled: (_result, error) =>
            refreshLibrary({ discardPatches: error !== null })
    });
}

/** Reloads the library's documents with a new version or a failed load, or every one. */
export function useReloadMutation(all: boolean) {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["reload", libraryId],
        mutationFn: (): Promise<ReloadOut> =>
            apiPost("/reload" + toLibraryPath(libraryId), {
                body: { forceReload: all }
            }),
        onError: getAppErrorHandler("Failed to reload documents."),
        onSuccess: (data) => {
            showInfoToast(`Reloading ${data.documents} documents...`);
        }
    });
}

export function useHoldNewVersionsQuery() {
    const libraryId = useLibraryId();
    return useQuery({
        queryKey: holdNewVersionsQueryKey(libraryId),
        queryFn: () =>
            apiGet<HoldNewVersionsOut>(
                "/hold-new-versions" + toLibraryPath(libraryId)
            )
    });
}

/** Shown before the server confirms; a failure puts it back. */
export function useSetHoldNewVersionsMutation() {
    const libraryId = useLibraryId();
    const queryKey = holdNewVersionsQueryKey(libraryId);
    return useMutation({
        mutationKey: ["hold-new-versions", libraryId],
        mutationFn: (holdNewVersions: boolean) =>
            apiPost<HoldNewVersionsOut>(
                "/hold-new-versions" + toLibraryPath(libraryId),
                { body: { holdNewVersions } }
            ),
        onMutate: (holdNewVersions) => {
            queryClient.setQueryData<HoldNewVersionsOut>(queryKey, {
                holdNewVersions
            });
        },
        onError: (error) => {
            void queryClient.invalidateQueries({ queryKey });
            handleAppError(
                error,
                "Failed to change whether new versions are held."
            );
        }
    });
}

export function useApproveVersionsMutation() {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["approve-versions", libraryId],
        mutationFn: () =>
            apiPost<ApproveVersionsOut>(
                "/approve-versions" + toLibraryPath(libraryId)
            ),
        onError: getAppErrorHandler("Failed to approve versions."),
        onSuccess: (data) => {
            showInfoToast(`Loading ${data.documents} approved documents...`);
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
                throw appError(INVALID_DOCUMENT_URL);
            }
            showLoadingToast("Adding document...", "add-group");
            modals.closeAll();
            return apiPost<{ name: string }>(
                "/group" + toLibraryPath(libraryId),
                { body: { newDocumentId, selectedGroupId } }
            );
        },
        onError: getAppErrorHandler(
            "Failed to add document. Make sure the document is valid.",
            "add-group"
        ),
        // The load goes on in the background, where the group shows its progress.
        onSuccess: ({ name }) => {
            showSuccessToast(`Added ${name}.`, "add-group");
        }
    });
}

/** A load doesn't wait for thumbnails, so this refetches one that was missing. */
export function useReloadThumbnailMutation(
    target: { groupId: string } | { insertableId: string }
) {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    return useMutation({
        mutationKey: ["reload-thumbnail", target],
        mutationFn: async () => {
            showLoadingToast("Reloading thumbnail...", "reload-thumbnail");
            return apiPost("/reload-thumbnail" + toLibraryPath(libraryId), {
                body: target
            });
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

const UPDATE_REFERENCES_TOAST = "update-references";

/**
 * Moves the document's out-of-date references, or one tab's, in its default
 * workspace. The library holds versions, so it shows nothing new until one is
 * cut; the change badges count the edit straight away.
 */
export function useUpdateReferencesMutation(
    documentId: string,
    elementId?: string
) {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["update-references", documentId, elementId],
        mutationFn: () => {
            showLoadingToast(
                m.libraryUpdatingReferences(),
                UPDATE_REFERENCES_TOAST
            );
            return apiPost<UpdateReferencesOut>("/update-references", {
                body: { documentId, elementId }
            });
        },
        onSuccess: async ({ updatedElements }) => {
            showSuccessToast(
                updatedElements > 0
                    ? m.libraryUpdatedReferences()
                    : m.libraryReferencesUpToDate(),
                UPDATE_REFERENCES_TOAST
            );
            await queryClient.invalidateQueries({
                queryKey: documentChangesQueryKey(libraryId, documentId)
            });
        },
        onError: getAppErrorHandler(
            m.libraryUpdateReferencesFailed(),
            UPDATE_REFERENCES_TOAST
        )
    });
}

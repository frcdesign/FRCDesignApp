/** Reads and writes of the library: its snapshot, cache version and load jobs. */
import {
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
    showLoadingToast
} from "../../lib/notifications";
import { getAppErrorHandler, appError } from "../../lib/errors";
import { modals } from "@mantine/modals";
import { parseOnshapeUrl } from "../../lib/url";
import { useRefreshLibrary } from "../../lib/refresh";

export function getLibraryQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryOut>({
        queryKey: libraryDataQueryKey(libraryId, cacheVersion),
        queryFn: async () =>
            apiGet("/library-data/library/" + libraryId, {
                cacheId: cacheVersion
            }),
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
    return useQuery(getLibraryVersionQuery(libraryId)).data ?? 0;
}

/** Poll a fresh job often, then back off: a full reload runs for hours. */
const FASTEST_POLL_MS = 3_000;
const POLL_STEPS = [
    { untilMs: 15_000, intervalMs: FASTEST_POLL_MS },
    { untilMs: 75_000, intervalMs: 5_000 }
];
const SLOWEST_POLL_MS = 10_000;

function jobPollInterval(runningForMs: number): number {
    const step = POLL_STEPS.find(({ untilMs }) => runningForMs < untilMs);
    return step?.intervalMs ?? SLOWEST_POLL_MS;
}

/**
 * Checked once on load, then polled while something runs and left alone when a
 * check comes back idle. `canPoll` is the caller's gate: the route is editor-only.
 */
function getJobStatusQuery(libraryId: LibraryId, canPoll: boolean) {
    return queryOptions<JobStatus>({
        queryKey: jobStatusQueryKey(libraryId),
        queryFn: () => apiGet("/job-status/library/" + libraryId),
        enabled: canPoll,
        // Every status badge observes this, so rows mounting as the user scrolls
        // would each trigger a fetch. Only the poll should set the pace.
        staleTime: FASTEST_POLL_MS,
        refetchInterval: (query) => {
            const status = query.state.data;
            if (!status?.running) {
                return false;
            }
            return jobPollInterval(status.runningForMs);
        }
    });
}

/**
 * Job status for the current library. The endpoint is editor-only and needs an
 * Onshape session, so callers who have neither don't poll it at all.
 */
/** Whether a library load is running, which several places show a spinner for. */
export function useIsJobRunning(): boolean {
    return useJobStatusQuery().data?.running ?? false;
}

function useJobStatusQuery() {
    const libraryId = useLibraryId();
    const { signedIn, currentAccessLevel } = useAccessData();
    return useQuery(
        getJobStatusQuery(
            libraryId,
            signedIn && hasEditorAccess(currentAccessLevel)
        )
    );
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
        onSuccess: refreshLibrary
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
        // Reconciled (or rolled back on error) by the onSettled library refetch.
        onSettled: refreshLibrary
    });
}

/**
 * Shows the spinner without waiting for a round trip, and starts the job poll,
 * which stays idle until something is known to be running.
 */
function markJobStarted(libraryId: LibraryId): void {
    const justStarted: JobStatus = { running: true, runningForMs: 0 };
    queryClient.setQueryData<JobStatus>(
        jobStatusQueryKey(libraryId),
        justStarted
    );
}

/** Reloads documents whose version moved on, or all of them. */
export function useReloadGroupsMutation(reloadAll: boolean) {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["reload-groups", libraryId],
        mutationFn: (): Promise<{ status: string }> =>
            apiPost("/reload-groups" + toLibraryPath(libraryId), {
                query: { forceReload: reloadAll }
            }),
        onError: getAppErrorHandler("Failed to reload documents!"),
        onSuccess: (data) => {
            markJobStarted(libraryId);
            showInfoToast(
                data.status === "already-running"
                    ? "A reload is already running."
                    : "Reloading documents..."
            );
        }
    });
}

/** Adds an Onshape document to the library, by its url. */
export function useAddGroupMutation(selectedGroupId?: string) {
    const libraryId = useLibraryId();
    return useMutation({
        mutationKey: ["add-group", libraryId],
        mutationFn: async (url: string) => {
            const newDocumentId = parseOnshapeUrl(url)?.documentId;
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
            markJobStarted(libraryId);
        }
    });
}

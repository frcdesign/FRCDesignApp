/** Queries for the library snapshot, its cache version, and its load jobs. */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import {
    type JobStatus,
    type LibraryOut
} from "../../../backend/features/library/dto";
import { hasEditorAccess } from "../../../backend/features/auth/access-level";
import { LibraryId } from "../../../backend/features/library/library-id";
import { useAccessData } from "../auth/access-level";
import { toLibraryPath, useLibraryId } from "./library-path";
import {
    jobStatusQueryKey,
    libraryQueryKey,
    libraryVersionQueryKey
} from "../../lib/query-keys";

export function getLibraryQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryOut>({
        queryKey: libraryQueryKey(libraryId, cacheVersion),
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
            apiGet("/library-version" + toLibraryPath(libraryId)).then(
                (result: { version: number }) => result.version
            ),
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
export function getJobStatusQuery(libraryId: LibraryId, canPoll: boolean) {
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
export function useJobStatusQuery() {
    const libraryId = useLibraryId();
    const { signedIn, currentAccessLevel } = useAccessData();
    return useQuery(
        getJobStatusQuery(
            libraryId,
            signedIn && hasEditorAccess(currentAccessLevel)
        )
    );
}

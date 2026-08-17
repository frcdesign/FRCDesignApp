/**
 * Queries for getting data from various endpoints on the backend.
 */
import {
    keepPreviousData,
    queryOptions,
    useQuery
} from "@tanstack/react-query";
import { apiGet, apiGetText } from "./api-utils/api";
import {
    type FavoritesData,
    type JobStatus,
    type LibraryBuildStatus,
    type LibraryOut
} from "../shared/api-models";
import { hasEditorAccess, LibraryId } from "../shared/types";
import { useAccessData } from "./api-utils/access-level";
import { toLibraryPath, useLibraryId } from "./api-utils/library";
import { EMPTY_UNIT_INFO, type UnitInfo } from "../shared/configuration-models";
import MiniSearch from "minisearch";
import { SEARCH_OPTIONS } from "../shared/search";
import { InstancePath } from "../shared/onshape-path";

export function getConfigurationMatchKey() {
    return ["configuration"];
}

export function getConfigurationKey(
    configurationId?: string,
    microversionId?: string
) {
    return ["configuration", configurationId, microversionId];
}

export function libraryQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return ["library", libraryId, cacheVersion];
}

export function libraryQueryMatchKey() {
    return ["library"];
}

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

export function libraryVersionQueryMatchKey() {
    return ["library-version"];
}

export function libraryVersionQueryKey(libraryId: LibraryId) {
    return ["library-version", libraryId];
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

/**
 * Returns the current document's units for the Insert dialog. Hits Onshape, so
 * it's disabled when not connected to a document; each quantity then falls back
 * to its own default unit.
 */
export function useUnitInfoQuery(instancePath: InstancePath, enabled = true) {
    return useQuery<UnitInfo>({
        queryKey: ["unit-info", instancePath],
        queryFn: () =>
            apiGet("/unit-info", {
                query: {
                    documentId: instancePath.documentId,
                    instanceId: instancePath.instanceId,
                    instanceType: instancePath.instanceType
                }
            }),
        enabled,
        placeholderData: EMPTY_UNIT_INFO
    });
}

export function searchDbQueryMatchKey() {
    return ["search-db"];
}

export function searchDbQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return ["search-db", libraryId, cacheVersion];
}

export function getSearchDbQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<MiniSearch | null>({
        queryKey: searchDbQueryKey(libraryId, cacheVersion),
        queryFn: async () => {
            const searchDb = await apiGetText(
                "/search-db" + toLibraryPath(libraryId),
                {
                    cacheId: cacheVersion
                }
            );
            if (!searchDb) {
                return null;
            }
            return MiniSearch.loadJSON(searchDb, SEARCH_OPTIONS);
        },
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useSearchDbQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return useQuery(getSearchDbQuery(libraryId, cacheVersion));
}

export function favoritesQueryKey(libraryId: LibraryId) {
    return ["favorites", libraryId];
}

const EMPTY_FAVORITES: FavoritesData = { favorites: {}, favoriteOrder: [] };

export function getFavoritesQuery(libraryId: LibraryId, enabled = true) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: () => apiGet("/favorites/library/" + libraryId),
        enabled,
        // Not signed in: the endpoint 401s, so present no favorites.
        placeholderData: EMPTY_FAVORITES
    });
}

export function buildStatusQueryMatchKey() {
    return ["build-status"];
}

export function buildStatusQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return ["build-status", libraryId, cacheVersion];
}

export function getBuildStatusQuery(
    libraryId: LibraryId,
    cacheVersion: number
) {
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

export function useBuildStatusQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return useQuery(getBuildStatusQuery(libraryId, cacheVersion));
}

export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    // Favorites require sign-in; don't fetch (or display) them otherwise.
    const signedIn = useAccessData().signedIn;
    return useQuery(getFavoritesQuery(libraryId, signedIn));
}

export function jobStatusQueryMatchKey() {
    return ["job-status"];
}

export function jobStatusQueryKey(libraryId: LibraryId) {
    return ["job-status", libraryId];
}

/**
 * How often to re-check a running job, by how long it has been running. A
 * just-started job is checked often so the UI reacts promptly, then the cadence
 * backs off — a full reload runs for hours and doesn't warrant a request every
 * few seconds for all of it.
 */
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
 * Whether a library-load job is running, polled so indicators stay live.
 *
 * An idle library isn't polled at all. Polling starts when there's known to be
 * something to watch — either the build status reported a job already running
 * when the app loaded (`jobRunningAtLoad`), or starting one seeded `running`
 * here directly — and stops again as soon as a check comes back not-running.
 * `canPoll` is the caller's own gate: the route is editor-only.
 */
export function getJobStatusQuery(
    libraryId: LibraryId,
    jobRunningAtLoad: boolean,
    canPoll: boolean
) {
    return queryOptions<JobStatus>({
        queryKey: jobStatusQueryKey(libraryId),
        queryFn: () => apiGet("/job-status/library/" + libraryId),
        enabled: (query) =>
            canPoll &&
            (jobRunningAtLoad || (query.state.data?.running ?? false)),
        // Every status badge observes this query, so rows mounting as the user
        // scrolls would otherwise each trigger a fetch. The poll is the only
        // thing that should set the pace.
        staleTime: FASTEST_POLL_MS,
        refetchInterval: (query) => {
            const status = query.state.data;
            if (!status?.running) {
                return false;
            }
            // An unknown age means the job predates age tracking, so it is old.
            return jobPollInterval(status.runningForMs ?? Infinity);
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
    // Already fetched by the build-status consumers; reused here rather than
    // spending a separate request just to learn whether to start polling.
    const jobRunningAtLoad = useBuildStatusQuery().data?.jobRunning ?? false;
    return useQuery(
        getJobStatusQuery(
            libraryId,
            jobRunningAtLoad,
            signedIn && hasEditorAccess(currentAccessLevel)
        )
    );
}

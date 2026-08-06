/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
import { apiGet } from "./api-utils/api";
import {
    type FavoritesData,
    type LibraryBuildStatus,
    type LibraryOut
} from "../shared/api-models";
import { type LibraryJobsData } from "../shared/library-job-models";
import { LibraryId } from "../shared/types";
import { ContextData, hasEditorAccess } from "../shared/types";
import { useLibraryId } from "./api-utils/library";
import { type UnitInfo } from "../shared/configuration-models";
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
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useQuery(getLibraryQuery(libraryId, cacheVersion));
}

export function contextDataQueryKey() {
    return ["context-data"];
}

/** Returns core application context data needed to load most other endpoints. */
export function getContextDataQuery() {
    return queryOptions<ContextData>({
        queryKey: contextDataQueryKey(),
        queryFn: () => apiGet("/context-data")
    });
}

/** Returns information needed to format unit expressions in the Insert dialog. */
export function useUnitInfoQuery(instancePath: InstancePath) {
    return useQuery<UnitInfo>({
        queryKey: ["unit-info", instancePath],
        queryFn: () =>
            apiGet("/unit-info", {
                query: {
                    documentId: instancePath.documentId,
                    instanceId: instancePath.instanceId,
                    instanceType: instancePath.instanceType
                }
            })
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
        queryFn: async () =>
            apiGet("/search-db/library/" + libraryId, {
                cacheId: cacheVersion
            }).then((result: { searchDb: string | null }) => {
                if (!result.searchDb) return null;
                return MiniSearch.loadJSON(result.searchDb, SEARCH_OPTIONS);
            }),
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useSearchDbQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useQuery(getSearchDbQuery(libraryId, cacheVersion));
}

export function favoritesQueryKey(libraryId: LibraryId) {
    return ["favorites", libraryId];
}

export function getFavoritesQuery(libraryId: LibraryId) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: () => apiGet("/favorites/library/" + libraryId)
    });
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
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useBuildStatusQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useQuery(getBuildStatusQuery(libraryId, cacheVersion));
}

export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    return useQuery(getFavoritesQuery(libraryId));
}

export function libraryJobsQueryKey(libraryId: LibraryId) {
    return ["library-jobs", libraryId];
}

// Poll aggressively while a job is fresh, then back off as it ages — long
// library reloads can run for many minutes and don't need second-by-second
// updates the whole time. The KV-cached access level keeps the fast tier cheap.
const FAST_POLL_MS = 3000;
const MID_POLL_MS = 8000;
const SLOW_POLL_MS = 15000;

function libraryJobPollInterval(
    data: LibraryJobsData | undefined
): number | false {
    const running = (data?.libraryJobs ?? []).filter(
        (job) => job.status === "running"
    );
    if (running.length === 0) return false;
    const oldestStart = Math.min(...running.map((job) => job.createdAt));
    const elapsed = Date.now() - oldestStart;
    if (elapsed < 30_000) return FAST_POLL_MS;
    if (elapsed < 180_000) return MID_POLL_MS;
    return SLOW_POLL_MS;
}

/**
 * Recent library jobs for the current library. Only enabled for editors (the
 * endpoint is editor-gated), and only polls while a job is running.
 */
export function getLibraryJobsQuery(libraryId: LibraryId, enabled: boolean) {
    return queryOptions<LibraryJobsData>({
        queryKey: libraryJobsQueryKey(libraryId),
        queryFn: () => apiGet("/library-jobs/library/" + libraryId),
        enabled,
        refetchInterval: (query) => libraryJobPollInterval(query.state.data)
    });
}

export function useLibraryJobsQuery() {
    const libraryId = useLibraryId();
    const maxAccessLevel = useLoaderData({ from: "/app" }).accessData
        .maxAccessLevel;
    return useQuery(
        getLibraryJobsQuery(libraryId, hasEditorAccess(maxAccessLevel))
    );
}

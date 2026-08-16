/**
 * Queries for getting data from various endpoints on the backend.
 */
import {
    keepPreviousData,
    queryOptions,
    useQuery
} from "@tanstack/react-query";
import { apiGet } from "./api-utils/api";
import {
    type FavoritesData,
    type LibraryBuildStatus,
    type LibraryOut
} from "../shared/api-models";
import { LibraryId } from "../shared/types";
import { ContextData, type LibraryVersions } from "../shared/types";
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
    const cacheVersion = useCacheVersion();
    return useQuery(getLibraryQuery(libraryId, cacheVersion));
}

export function libraryVersionsQueryKey() {
    return ["library-versions"];
}

/** Every library's cache version, which keys the `?v=` on library requests. */
export function getLibraryVersionsQuery() {
    return queryOptions<LibraryVersions>({
        queryKey: libraryVersionsQueryKey(),
        queryFn: () =>
            apiGet("/library-versions").then(
                (result: { versions: LibraryVersions }) => result.versions
            ),
        // Bumps arrive through the explicit refresh flows, which refetch this.
        staleTime: Infinity
    });
}

/** The displayed library's cache version, which keys its immutable responses. */
export function useCacheVersion(): number {
    const libraryId = useLibraryId();
    // Loaded by the library route before anything reading this renders.
    const { data } = useQuery(getLibraryVersionsQuery());
    return data?.[libraryId] ?? 0;
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
    const cacheVersion = useCacheVersion();
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
    return useQuery(getFavoritesQuery(libraryId));
}

export function jobStatusQueryMatchKey() {
    return ["job-status"];
}

export function jobStatusQueryKey(libraryId: LibraryId) {
    return ["job-status", libraryId];
}

/** Whether a library-load job is running; polled so indicators stay live. */
export function getJobStatusQuery(libraryId: LibraryId) {
    return queryOptions<{ running: boolean }>({
        queryKey: jobStatusQueryKey(libraryId),
        queryFn: () => apiGet("/job-status/library/" + libraryId),
        refetchInterval: 10_000
    });
}

/** Only mounted by editor-gated components, so only editors poll. */
export function useJobStatusQuery() {
    const libraryId = useLibraryId();
    return useQuery(getJobStatusQuery(libraryId));
}

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
import { type AccessData } from "../shared/types";
import { toLibraryPath, useLibraryId } from "./api-utils/library";
import {
    DEFAULT_UNIT_INFO,
    type UnitInfo
} from "../shared/configuration-models";
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

export function accessDataQueryKey() {
    return ["access-data"];
}

/** The caller's access level, which gates editor-only affordances. */
export function getAccessDataQuery() {
    return queryOptions<AccessData>({
        queryKey: accessDataQueryKey(),
        queryFn: () => apiGet("/access-data")
    });
}

/**
 * Returns the current document's units for the Insert dialog. Hits Onshape, so
 * it's disabled when not connected to a document; a default placeholder lets the
 * dialog render immediately either way.
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
        placeholderData: DEFAULT_UNIT_INFO
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

const EMPTY_FAVORITES: FavoritesData = { favorites: {}, favoriteOrder: [] };

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
    // Favorites require sign-in; the endpoint 401s otherwise, so present none.
    const signedIn = useQuery(getAccessDataQuery()).data?.signedIn ?? false;
    const query = useQuery({
        ...getFavoritesQuery(libraryId),
        enabled: signedIn
    });
    return signedIn ? query : { ...query, data: EMPTY_FAVORITES };
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

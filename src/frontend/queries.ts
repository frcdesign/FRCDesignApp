/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
    apiGet,
    CacheOptions,
    toCacheOptions,
    useCacheOptions
} from "./api-utils/api";
import { type FavoritesData, type LibraryOut } from "../shared/api-models";
import { LibraryId } from "../shared/types";
import { ContextData } from "../shared/types";
import { useLibraryId } from "./api-utils/library";
import { type UnitInfo } from "../shared/configuration-models";
import MiniSearch from "minisearch";
import { SEARCH_OPTIONS } from "./search/search";
import { InstancePath } from "../shared/onshape-path";

export function getConfigurationMatchKey() {
    return ["configuration"];
}

export function getConfigurationKey(
    libraryId: LibraryId,
    configurationId?: string,
    cacheOptions?: CacheOptions
) {
    return ["configuration", libraryId, configurationId, cacheOptions];
}

export function useLibraryQuery() {
    const cacheOptions = useCacheOptions();
    const libraryId = useLibraryId();
    return useQuery(getLibraryQuery(libraryId, cacheOptions));
}

export function libraryQueryKey(
    libraryId: LibraryId,
    cacheOptions: CacheOptions
) {
    return ["library", libraryId, toCacheOptions(cacheOptions)];
}

export function libraryQueryMatchKey() {
    return ["library"];
}

export function getLibraryQuery(
    libraryId: LibraryId,
    cacheOptions: CacheOptions
) {
    return queryOptions<LibraryOut>({
        queryKey: libraryQueryKey(libraryId, cacheOptions),
        queryFn: async () =>
            apiGet("/library-data/library/" + libraryId, { cacheOptions }),
        staleTime: Infinity,
        gcTime: Infinity
    });
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

export function searchDbQueryKey(
    libraryId: LibraryId,
    cacheOptions: CacheOptions
) {
    return ["search-db", libraryId, cacheOptions];
}

export function getSearchDbQuery(
    libraryId: LibraryId,
    cacheOptions: CacheOptions
) {
    return queryOptions<MiniSearch | null>({
        queryKey: searchDbQueryKey(libraryId, cacheOptions),
        queryFn: async () =>
            apiGet("/search-db/library/" + libraryId, { cacheOptions }).then(
                (result: { searchDb: string | null }) => {
                    if (!result.searchDb) return null;
                    return MiniSearch.loadJSON(result.searchDb, SEARCH_OPTIONS);
                }
            ),
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useSearchDbQuery() {
    const cacheOptions = useCacheOptions();
    const libraryId = useLibraryId();
    return useQuery(getSearchDbQuery(libraryId, cacheOptions));
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

export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    return useQuery(getFavoritesQuery(libraryId));
}

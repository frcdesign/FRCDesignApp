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
import { type FavoritesData } from "./api-utils/client-models";
import { Library } from "../shared/types";
import { ContextData } from "../shared/types";
import { type LibraryOut } from "../backend/routes/library";
import { useLibrary } from "./api-utils/library";
import { type UnitInfo } from "../shared/configuration-models";
import MiniSearch from "minisearch";
import { SEARCH_OPTIONS } from "./search/search";
import { InstancePath } from "../shared/path";

export function getConfigurationMatchKey() {
    return ["configuration"];
}

export function getConfigurationKey(
    library: Library,
    configurationId?: string,
    cacheOptions?: CacheOptions
) {
    return ["configuration", library, configurationId, cacheOptions];
}

export function useLibraryQuery() {
    const cacheOptions = useCacheOptions();
    const library = useLibrary();
    return useQuery(getLibraryQuery(library, cacheOptions));
}

export function libraryQueryKey(library: Library, cacheOptions: CacheOptions) {
    return ["library", library, toCacheOptions(cacheOptions)];
}

export function libraryQueryMatchKey() {
    return ["library"];
}

export function getLibraryQuery(library: Library, cacheOptions: CacheOptions) {
    return queryOptions<LibraryOut>({
        queryKey: libraryQueryKey(library, cacheOptions),
        queryFn: async () =>
            apiGet("/library-data", { query: { library }, cacheOptions }),
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

export function searchDbQueryKey(library: Library, cacheOptions: CacheOptions) {
    return ["search-db", library, cacheOptions];
}

export function getSearchDbQuery(library: Library, cacheOptions: CacheOptions) {
    return queryOptions<MiniSearch | null>({
        queryKey: searchDbQueryKey(library, cacheOptions),
        queryFn: async () =>
            apiGet("/search-db", { query: { library }, cacheOptions }).then(
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
    const library = useLibrary();
    return useQuery(getSearchDbQuery(library, cacheOptions));
}

export function favoritesQueryKey(library: Library) {
    return ["favorites", library];
}

export function getFavoritesQuery(library: Library) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(library),
        queryFn: () => apiGet("/favorites/" + library)
    });
}

export function useFavoritesQuery() {
    const library = useLibrary();
    return useQuery(getFavoritesQuery(library));
}

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
import { Library, LibraryUserData } from "./api-utils/client-models";
import { LibraryOut } from "./api/library";
import { useLibrary } from "./api-utils/library";
import { UnitInfo } from "./configurations/configuration-models";
import { useLoaderData, useSearch } from "@tanstack/react-router";
import MiniSearch from "minisearch";
import { SEARCH_OPTIONS } from "./search/search";
import { fetchLibraryUserData } from "./api/library";
import { fetchContextData, fetchUserData, ContextDataOut } from "./api/user";
import { InstancePath } from "./onshape-api/path";
import { UserData } from "./connect/db-models";
import { fetchUnitInfo } from "./configurations/configurations.functions";

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

export function libraryUserDataQueryMatchKey() {
    return ["library-user-data"];
}

export function libraryUserDataQueryKey(library: Library, userId: string) {
    return ["library-user-data", library, userId];
}

export function getLibraryUserDataQuery(library: Library, userId: string) {
    return queryOptions<LibraryUserData>({
        queryKey: libraryUserDataQueryKey(library, userId),
        queryFn: () => fetchLibraryUserData({ data: { library } })
    });
}

export function useLibraryUserDataQuery() {
    const library = useLibrary();
    const search = useSearch({ from: "/app" });
    return useQuery(getLibraryUserDataQuery(library, search.userId));
}

export function contextDataQueryKey(library: Library) {
    return ["context-data", library];
}

/** Returns core application context data needed to load most other endpoints. */
export function getContextDataQuery(library: Library) {
    return queryOptions<ContextDataOut>({
        queryKey: contextDataQueryKey(library),
        queryFn: () => fetchContextData({ data: { library } })
    });
}

export function userDataQueryKey() {
    return ["user-data"];
}

/** Returns the current user's stored data. */
export function getUserDataQuery() {
    return queryOptions<UserData>({
        queryKey: userDataQueryKey(),
        queryFn: () => fetchUserData()
    });
}

export function useUserData(): UserData {
    return useLoaderData({ from: "/app" });
}

/** Returns information needed to format unit expressions in the Insert dialog. */
export function useUnitInfoQuery(instancePath: InstancePath) {
    return useQuery<UnitInfo>({
        queryKey: ["unit-info", instancePath],
        queryFn: () => fetchUnitInfo({ data: { instancePath } })
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

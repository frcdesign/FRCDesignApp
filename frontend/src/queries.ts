/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
    apiGet,
    CacheOptions,
    toCacheOptions,
    useCacheOptions
} from "./api/api";
import {
    LibraryUserData,
    UserData,
    Library,
    LibraryObj,
    ContextData
} from "./api/models";
import {
    InstancePath,
    toInstanceApiPath,
    toUserApiPath,
    UserPath
} from "./api/path";
import { toLibraryPath, useLibrary } from "./api/library";
import { UnitInfo } from "./insert/configuration-models";
import { useLoaderData, useSearch } from "@tanstack/react-router";

export function getConfigurationMatchKey() {
    return ["configuration"];
}

export function getConfigurationKey(configurationId?: string) {
    return ["configuration", configurationId];
}

export function updateSettingsKey(userPath: UserPath) {
    return ["user-data", toUserApiPath(userPath)];
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
    return queryOptions<LibraryObj>({
        queryKey: libraryQueryKey(library, cacheOptions),
        queryFn: async () => apiGet(toLibraryPath(library), { cacheOptions }),
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function libraryUserDataQueryKey(library: Library, userPath: UserPath) {
    return ["library-user-data", library, userPath.userId];
}

export function getLibraryUserDataQuery(library: Library, userPath: UserPath) {
    return queryOptions<LibraryUserData>({
        queryKey: libraryUserDataQueryKey(library, userPath),
        queryFn: async () =>
            apiGet(
                "/library-user-data" +
                    toLibraryPath(library) +
                    toUserApiPath(userPath)
            )
    });
}

export function useLibraryUserDataQuery() {
    const search = useSearch({ from: "/app" });
    const library = useLibrary();
    return useQuery(getLibraryUserDataQuery(library, search));
}

export function contextDataQueryKey(userPath: UserPath) {
    return ["context-data", userPath.userId];
}

/**
 * Returns core application context data needed to load most other endpoints.
 */
export function getContextDataQuery(userPath: UserPath) {
    return queryOptions<ContextData>({
        queryKey: contextDataQueryKey(userPath),
        queryFn: async () => apiGet("/context-data" + toUserApiPath(userPath))
    });
}

export function userDataQueryKey(userPath: UserPath) {
    return ["user-data", userPath.userId];
}

/**
 * Returns user data needed to load most other endpoints.
 */
export function getUserDataQuery(userPath: UserPath) {
    return queryOptions<UserData>({
        queryKey: userDataQueryKey(userPath),
        queryFn: async () => apiGet("/user-data" + toUserApiPath(userPath))
    });
}

export function useUserData() {
    return useLoaderData({ from: "/app" });
}

/**
 * Returns information needed to format unit expressions in the Insert dialog.
 */
export function useUnitInfoQuery(instancePath: InstancePath) {
    return useQuery<UnitInfo>({
        queryKey: ["unit-info", instancePath],
        queryFn: async () =>
            apiGet("/unit-info" + toInstanceApiPath(instancePath))
    });
}

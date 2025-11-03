/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, CacheOptions, useCacheOptions } from "./api/api";
import { LibraryUserData, UserData, Library, LibraryObj } from "./api/models";
import {
    InstancePath,
    toInstanceApiPath,
    toUserApiPath,
    UserPath
} from "./api/path";
import { toLibraryPath, useLibrary } from "./api/library";
import { UnitInfo } from "./insert/configuration-models";
import { useSearch } from "@tanstack/react-router";

export function updateSettingsKey(userPath: UserPath) {
    return ["user-data", toUserApiPath(userPath)];
}

export function useLibraryQuery() {
    const cacheOptions = useCacheOptions();
    const library = useLibrary();
    return useQuery(getLibraryQuery(library, cacheOptions));
}

export function libraryQueryKey(library: Library, cacheOptions: CacheOptions) {
    return ["library", library, cacheOptions];
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
    return ["library-user-data", library, userPath];
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
    return useQuery(getLibraryUserDataQuery(search.library, search));
}

export function userDataQueryKey(userPath: UserPath) {
    return ["user-data", userPath];
}

/**
 * Returns core application data needed to load most other endpoints.
 */
export function getUserDataQuery(userPath: UserPath) {
    return queryOptions<UserData>({
        queryKey: userDataQueryKey(userPath),
        queryFn: async () => apiGet("/user-data" + toUserApiPath(userPath))
    });
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

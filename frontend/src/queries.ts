/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, CacheOptions, useCacheOptions } from "./api/api";
import {
    UnitInfo,
    DocumentOrder,
    Documents,
    Elements,
    UserData,
    CacheData
} from "./api/models";
import {
    InstancePath,
    toInstanceApiPath,
    toUserApiPath,
    UserPath
} from "./api/path";
import { useLoaderData } from "@tanstack/react-router";

export function getDocumentsQuery(cacheOptions: CacheOptions) {
    return queryOptions<Documents>({
        queryKey: ["documents"],
        queryFn: async () =>
            apiGet("/documents", { cacheOptions }).then(
                (result) => result.documents
            )
    });
}

export function useDocumentsQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getDocumentsQuery(cacheOptions));
}

export function getDocumentOrderQuery(cacheOptions: CacheOptions) {
    return queryOptions<DocumentOrder>({
        queryKey: ["document-order"],
        queryFn: async () =>
            apiGet("/document-order", { cacheOptions }).then(
                (result) => result.documentOrder
            )
    });
}

export function useDocumentOrderQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getDocumentOrderQuery(cacheOptions));
}

export function getElementsQuery(cacheOptions: CacheOptions) {
    return queryOptions<Elements>({
        queryKey: ["elements"],
        queryFn: async () =>
            apiGet("/elements", { cacheOptions }).then(
                (result) => result.elements
            )
    });
}

export function useElementsQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getElementsQuery(cacheOptions));
}

export function getUserDataQuery(userPath: UserPath) {
    return queryOptions<UserData>({
        queryKey: ["user-data"],
        queryFn: async () => apiGet("/user-data" + toUserApiPath(userPath)),
        // Favorites shouldn't go stale, although they can get changed in another tab
        staleTime: 60 * 1000 // 1 minute
    });
}

export function useUserData(): UserData {
    return useLoaderData({ from: "/app" });
}

/**
 * Returns core application cache data needed to load most other endpoints.
 */
export function getCacheDataQuery() {
    return queryOptions<CacheData>({
        queryKey: ["cache-data"],
        queryFn: async () => apiGet("/cache-data")
    });
}

/**
 * Returns information needed to format unit expressions in insert-dialogs.
 */
export function useUnitInfoQuery(instancePath: InstancePath) {
    return useQuery<UnitInfo>({
        queryKey: ["unit-info"],
        queryFn: async () =>
            apiGet("/unit-info" + toInstanceApiPath(instancePath))
    });
}

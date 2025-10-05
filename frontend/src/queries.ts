/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, CacheOptions, useCacheOptions } from "./api/api";
import {
    ContextData,
    DocumentOrder,
    Documents,
    Elements,
    UserData
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

export function getContextDataQuery(instancePath: InstancePath) {
    return queryOptions<ContextData>({
        queryKey: ["context-data"],
        queryFn: async () =>
            apiGet("/context-data" + toInstanceApiPath(instancePath))
    });
}

// export function getSearchDbQuery(cacheOptions: CacheOptions) {
//     return queryOptions<AnyOrama | undefined>({
//         queryKey: ["search-db"],
//         queryFn: async () =>
//             apiGet("/search-db", { cacheOptions }).then((result) => {
//                 if (!result.searchDb) {
//                     throw new Error("No search database found");
//                 }
//             })
//     });
// }

// export function useSearchDbQuery() {
//     const cacheOptions = useCacheOptions();
//     return useQuery(getSearchDbQuery(cacheOptions));
// }

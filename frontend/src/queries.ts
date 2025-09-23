import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, CacheOptions, useCacheOptions } from "./api/api";
import {
    ContextData,
    DocumentObj,
    DocumentOrder,
    Documents,
    ElementObj,
    Elements,
    Favorite,
    Favorites,
    Settings
} from "./api/models";
import {
    InstancePath,
    toInstanceApiPath,
    toUserApiPath,
    UserPath
} from "./api/path";
import { useLoaderData } from "@tanstack/react-router";

export function getDocumentsQuery(cacheOptions: CacheOptions) {
    return queryOptions({
        queryKey: ["documents"],
        queryFn: async () =>
            apiGet("/documents", { cacheOptions }).then((result) =>
                Object.fromEntries(
                    result.documents.map((document: DocumentObj) => [
                        document.id,
                        document
                    ])
                )
            ) as Promise<Documents>
    });
}

export function useDocumentsQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getDocumentsQuery(cacheOptions));
}

export function getDocumentOrderQuery(cacheOptions: CacheOptions) {
    return queryOptions({
        queryKey: ["document-order"],
        queryFn: async () =>
            apiGet("/document-order", { cacheOptions }).then(
                (result) => result.documentOrder
            ) as Promise<DocumentOrder>
    });
}

export function useDocumentOrderQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getDocumentOrderQuery(cacheOptions));
}

export function getElementsQuery(cacheOptions: CacheOptions) {
    return queryOptions({
        queryKey: ["elements"],
        queryFn: async () =>
            apiGet("/elements", { cacheOptions }).then((result) =>
                Object.fromEntries(
                    result.elements.map((element: ElementObj) => [
                        element.id,
                        element
                    ])
                )
            ) as Promise<Elements>
    });
}

export function useElementsQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getElementsQuery(cacheOptions));
}

export function getFavoritesQuery(userPath: UserPath) {
    return queryOptions({
        queryKey: ["favorites"],
        queryFn: async () =>
            apiGet("/favorites" + toUserApiPath(userPath)).then((result) =>
                Object.fromEntries(
                    result.favorites.map((favorite: Favorite) => [
                        favorite.id,
                        favorite
                    ])
                )
            ) as Promise<Favorites>,
        // Favorites shouldn't go stale, although they can get changed in another tab
        staleTime: 60 * 1000
    });
}

export function useFavoritesQuery(userPath: UserPath) {
    return useQuery(getFavoritesQuery(userPath));
}

export function getSettingsQuery(userPath: UserPath) {
    return queryOptions<Settings>({
        queryKey: ["settings"],
        queryFn: async () => apiGet("/settings" + toUserApiPath(userPath))
    });
}

export function useSettings(): Settings {
    return useLoaderData({ from: "/app" });
}

export function getContextDataQuery(instancePath: InstancePath) {
    return queryOptions<ContextData>({
        queryKey: ["context-data"],
        queryFn: async () =>
            apiGet("/context-data" + toInstanceApiPath(instancePath))
    });
}

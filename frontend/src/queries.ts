import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "./api/api";
import {
    DocumentObj,
    Documents,
    Elements,
    Favorite,
    Favorites,
    ElementObj,
    DocumentOrder,
    Settings,
    AccessLevel,
    Unit
} from "./api/backend-types";
import {
    InstancePath,
    toInstanceApiPath,
    toUserApiPath,
    UserPath
} from "./api/path";
import { useLoaderData } from "@tanstack/react-router";

export function getDocumentsQuery() {
    return queryOptions({
        queryKey: ["documents"],
        queryFn: async () =>
            apiGet("/documents").then((result) =>
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
    return useQuery(getDocumentsQuery());
}

export function getDocumentOrderQuery() {
    return queryOptions({
        queryKey: ["document-order"],
        queryFn: async () =>
            apiGet("/document-order").then(
                (result) => result.documentOrder
            ) as Promise<DocumentOrder>
    });
}

export function useDocumentOrderQuery() {
    return useQuery(getDocumentOrderQuery());
}

export function getElementsQuery() {
    return queryOptions({
        queryKey: ["elements"],
        queryFn: async () =>
            apiGet("/elements").then((result) =>
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
    return useQuery(getElementsQuery());
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

export interface ContextData {
    maxAccessLevel: AccessLevel;
    currentAccessLevel: AccessLevel;
    angleUnit: Unit;
    lengthUnit: Unit;
    lengthPrecision: number;
    anglePrecision: number;
    realPrecision: number;
}

export function getContextDataQuery(instancePath: InstancePath) {
    return queryOptions<ContextData>({
        queryKey: ["context-data"],
        queryFn: async () =>
            apiGet("/context-data" + toInstanceApiPath(instancePath))
    });
}

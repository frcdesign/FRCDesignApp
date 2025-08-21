import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "./api/api";
import {
    DocumentObj,
    DocumentsResult,
    ElementsResult,
    Favorite,
    FavoritesResult,
    ElementObj,
    DocumentOrderResult
} from "./api/backend-types";
import { toUserApiPath, UserPath } from "./api/path";

export function getDocumentsQuery() {
    return queryOptions({
        queryKey: ["documents"],
        queryFn: () =>
            apiGet("/documents").then((result) =>
                Object.fromEntries(
                    result.documents.map((document: DocumentObj) => [
                        document.id,
                        document
                    ])
                )
            ) as Promise<DocumentsResult>
    });
}

export function useDocumentsQuery() {
    return useQuery(getDocumentsQuery());
}

export function getDocumentOrderQuery() {
    return queryOptions({
        queryKey: ["document-order"],
        queryFn: () =>
            apiGet("/document-order").then(
                (result) => result.documentOrder
            ) as Promise<DocumentOrderResult>
    });
}

export function useDocumentOrderQuery() {
    return useQuery(getDocumentOrderQuery());
}

export function getElementsQuery() {
    return queryOptions({
        queryKey: ["elements"],
        queryFn: () =>
            apiGet("/elements").then((result) =>
                Object.fromEntries(
                    result.elements.map((element: ElementObj) => [
                        element.id,
                        element
                    ])
                )
            ) as Promise<ElementsResult>
    });
}

export function useElementsQuery() {
    return useQuery(getElementsQuery());
}

export function getFavoritesQuery(userPath: UserPath) {
    return queryOptions({
        queryKey: ["favorites"],
        queryFn: () =>
            apiGet("/favorites" + toUserApiPath(userPath)).then((result) =>
                Object.fromEntries(
                    result.favorites.map((favorite: Favorite) => [
                        favorite.id,
                        favorite
                    ])
                )
            ) as Promise<FavoritesResult>,
        // Favorites shouldn't go stale, although they can get set externally
        staleTime: 60 * 1000
    });
}

export function useFavoritesQuery(userPath: UserPath) {
    return useQuery(getFavoritesQuery(userPath));
}

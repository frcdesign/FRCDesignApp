import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "./api/api";
import {
    DocumentObj,
    DocumentsResult,
    ElementsResult,
    Favorite,
    FavoritesResult,
    ElementObj
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
            ) as Promise<FavoritesResult>
    });
}

export function useFavoritesQuery(userPath: UserPath) {
    return useQuery(getFavoritesQuery(userPath));
}

import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "./api/api";
import { DocumentResult, FavoritesResult } from "./api/backend-types";
import { toUserApiPath, UserPath } from "./api/path";

export function getDocumentLoader() {
    return queryOptions<DocumentResult>({
        queryKey: ["documents"],
        queryFn: () => apiGet("/documents")
    });
}

export function getFavoritesLoader(userPath: UserPath) {
    return queryOptions<FavoritesResult>({
        queryKey: ["favorites"],
        queryFn: () =>
            apiGet("/favorites" + toUserApiPath(userPath)).then(
                (result) => result.favorites
            )
    });
}

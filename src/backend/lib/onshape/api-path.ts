import { DocumentPath } from "./path";

export interface ApiPathOptions {
    endRoute?: string;
    endId?: string;
    featureId?: string;
    /**
     * When true and the path is a DocumentPath, emits `/{documentId}` instead of `/d/{documentId}`.
     * Used for document-level Onshape endpoints that don't use the `/d/` prefix.
     */
    skipDocumentD?: boolean;
}

/**
 * @example
 * apiPath("documents", instancePath, toInstanceApiPath, { endRoute: "elements" })
 * // → "/documents/d/{did}/w/{wid}/elements"
 */
export function apiPath<T extends DocumentPath = DocumentPath>(
    route: string,
    path?: T,
    serialize?: (path: T) => string,
    options?: ApiPathOptions
): string {
    let result = route.startsWith("/") ? route : "/" + route;

    if (path !== undefined) {
        if (options?.skipDocumentD) {
            result += "/" + path.documentId;
        } else if (serialize !== undefined) {
            result += serialize(path);
        }
    }

    if (options?.endRoute !== undefined) {
        const end = options.endRoute;
        result += end.startsWith("/") ? end : "/" + end;
    }

    if (options?.endId !== undefined) {
        result += "/" + encodeURIComponent(options.endId);
    }

    if (options?.featureId !== undefined) {
        result += "/featureId/" + encodeURIComponent(options.featureId);
    }

    return result;
}

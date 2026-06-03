import { DocumentPath } from "../../shared/onshape-path";

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
 * Constructs a path suitable for the Onshape REST API.
 *
 * @param route - The Onshape service name, e.g. `"documents"` or `"assemblies"`.
 * @param path - A path object to embed in the URL.
 * @param serialize - Converts `path` to its URL segment, e.g. `toInstanceApiPath`.
 * @param options - Optional tail segments and flags.
 *
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

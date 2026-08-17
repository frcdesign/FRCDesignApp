import {
    createSearchParams,
    type URLSearchParamsInit,
    type QueryOptions,
    type PostOptions
} from "../common/utils";
import { HandledError } from "./errors";
import { HttpStatus } from "http-status-ts";

function getUrl(
    path: string,
    query?: URLSearchParamsInit,
    cacheId?: string | number
): string {
    const searchParams = createSearchParams(query);
    if (cacheId !== undefined) {
        searchParams.append("v", cacheId.toString());
    }
    return "/api" + path + `?${searchParams}`;
}

/**
 * Makes a post request to a backend /api route.
 */
export async function apiPost(
    path: string,
    options?: PostOptions
): Promise<any> {
    return fetch(getUrl(path, options?.query), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options?.body ?? {}),
        signal: options?.signal
    }).then(handleResponse);
}

interface QueryOptionsWithCacheId extends QueryOptions {
    cacheId?: string | number;
}

/**
 * Makes a get request to a backend /api route.
 */
export async function apiGet(
    path: string,
    options?: QueryOptionsWithCacheId
): Promise<any> {
    return fetch(getUrl(path, options?.query, options?.cacheId), {
        signal: options?.signal
    }).then(handleResponse);
}

/**
 * Gets a response formatted as a raw string from a backend /api route.
 */
export async function apiGetText(
    path: string,
    options?: QueryOptionsWithCacheId
): Promise<string | null> {
    const response = await fetch(
        getUrl(path, options?.query, options?.cacheId),
        { signal: options?.signal }
    );
    if (response.status === HttpStatus.NOT_FOUND) {
        return null;
    }
    if (!response.ok) {
        throw new Error("Network response failed.");
    }
    return await response.text();
}

/**
 * Checks that an image URL resolves, and returns it to render.
 *
 * Fetching it here both surfaces failures as a rejected query (so callers keep
 * their loading, error, and retry behavior) and puts the response in the browser
 * cache, so the `<img>` that follows is served from it. Returning the URL rather
 * than an object URL matters: a blob URL lives until the page unloads, and
 * nothing can safely revoke one that a cached query may still be sharing.
 */
export async function loadImage(
    url: string,
    signal?: AbortSignal
): Promise<string> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error("Network response failed.");
    }
    return url;
}

/** {@link loadImage} for a backend /api route. */
export async function loadApiImage(
    path: string,
    options?: QueryOptionsWithCacheId
): Promise<string> {
    return loadImage(
        getUrl(path, options?.query, options?.cacheId),
        options?.signal
    );
}

/**
 * Makes a delete request to a backend /api route.
 */
export async function apiDelete(
    path: string,
    options?: QueryOptions
): Promise<any> {
    return fetch(getUrl(path, options?.query), {
        method: "DELETE",
        signal: options?.signal
    }).then(handleResponse);
}

async function handleResponse(response: Response) {
    const json = await response.json();
    if (!response.ok) {
        if (json.type === "handled") {
            throw new HandledError(json.message, json.isError);
        }
        throw new Error("Network response failed.");
    }
    return json;
}

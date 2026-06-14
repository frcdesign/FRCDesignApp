import {
    createSearchParams,
    type URLSearchParamsInit,
    type QueryOptions,
    type PostOptions
} from "../common/utils";
import { HandledError } from "./errors";

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

export async function apiGetRawImage(
    url: string,
    signal?: AbortSignal
): Promise<string> {
    return fetch(url, {
        signal
    }).then(handleImageResponse);
}

/**
 * Makes a get request for an image to a backend /api route.
 * Returns a local url for the image.
 */
export async function apiGetImage(
    path: string,
    options?: QueryOptionsWithCacheId
): Promise<string> {
    return fetch(getUrl(path, options?.query, options?.cacheId), {
        signal: options?.signal
    }).then(handleImageResponse);
}

async function handleImageResponse(response: Response) {
    if (!response.ok) {
        throw new Error("Network response failed.");
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
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

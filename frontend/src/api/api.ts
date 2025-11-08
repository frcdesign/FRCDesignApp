import { useSearch } from "@tanstack/react-router";
import { createSearchParams, URLSearchParamsInit } from "../common/utils";
import { AccessLevel, hasMemberAccess } from "./models";
import { HandledError } from "./errors";

function getUrl(
    path: string,
    query?: URLSearchParamsInit,
    cacheOptions?: CacheOptions
): string {
    const searchParams = createSearchParams(query);
    if (cacheOptions) {
        if (hasMemberAccess(cacheOptions.currentAccessLevel)) {
            // Makes the path /api/admin/...
            path = "/admin" + path;
        } else {
            // Append the v parameter to bust the cache when the cache version changes
            searchParams.append("v", cacheOptions.cacheVersion.toString());
        }
    }

    return "/api" + path + `?${searchParams}`;
}

interface QueryOptions {
    query?: URLSearchParamsInit;
    signal?: AbortSignal;
}

interface PostOptions extends QueryOptions {
    body?: object;
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

export interface CacheOptions {
    currentAccessLevel: AccessLevel;
    cacheVersion: number;
}

export function toCacheOptions(cacheOptions: CacheOptions): CacheOptions {
    return {
        currentAccessLevel: cacheOptions.currentAccessLevel,
        cacheVersion: cacheOptions.cacheVersion
    };
}

export function useCacheOptions(): CacheOptions {
    const search = useSearch({ from: "/app" });
    return {
        currentAccessLevel: search.currentAccessLevel,
        cacheVersion: search.cacheVersion
    };
}

interface QueryOptionsWithCache extends QueryOptions {
    cacheOptions?: CacheOptions;
}

/**
 * Makes a get request to a backend /api route.
 */
export async function apiGet(
    path: string,
    options?: QueryOptionsWithCache
): Promise<any> {
    return fetch(getUrl(path, options?.query, options?.cacheOptions), {
        signal: options?.signal
    }).then(handleResponse);
}

/**
 * Makes a get request for an image to a backend /api route.
 * Returns a local url for the image.
 */
export async function apiGetImage(
    path: string,
    options?: QueryOptionsWithCache
): Promise<string> {
    return fetch(getUrl(path, options?.query, options?.cacheOptions), {
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
            throw new HandledError(json.message);
        }
        throw new Error("Network response failed.");
    }
    return json;
}

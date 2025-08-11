import { reportMissingPermissionError } from "./errors";
import {
    createSearchParams,
    URLSearchParamsInit
} from "../common/search-params";

function getUrl(path: string, query?: URLSearchParamsInit): string {
    path = "/api" + path;
    if (query) {
        path += `?${createSearchParams(query)}`;
    }
    return path;
}

interface PostOptions {
    query?: URLSearchParamsInit;
    body?: object;
    signal?: AbortSignal;
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

/**
 * Makes a get request to a backend /api route.
 */
export async function apiGet(
    path: string,
    query?: URLSearchParamsInit,
    signal?: AbortSignal
): Promise<any> {
    return fetch(getUrl(path, query), {
        signal
    }).then(handleResponse);
}

/**
 * Makes a get request for an image to a backend /api route.
 * Returns a local url for the image.
 */
export async function apiGetImage(
    path: string,
    query?: URLSearchParamsInit,
    signal?: AbortSignal
): Promise<string> {
    return fetch(getUrl(path, query), { signal }).then(handleImageResponse);
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
    query?: URLSearchParamsInit
): Promise<any> {
    return fetch(getUrl(path, query), { method: "DELETE" }).then(
        handleResponse
    );
}

async function handleResponse(response: Response) {
    const json = await response.json();
    if (!response.ok) {
        reportMissingPermissionError(json);
        throw new Error("Network response failed.");
    }
    return json;
}

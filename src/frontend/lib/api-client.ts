import {
    createSearchParams,
    type URLSearchParamsInit,
    type QueryOptions,
    type PostOptions
} from "@backend/lib/query-params";
import { fromApiErrorBody } from "./errors";
import { THUMBNAIL_FALLBACK_HEADER } from "@backend/features/thumbnails/keys";
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
 * The route's response, as the route says it is. `T` is inferred from the call
 * site, so a contract that stops matching is an error there, not an `any`.
 */
export async function apiPost<T>(
    path: string,
    options?: PostOptions
): Promise<T> {
    const response = await fetch(getUrl(path, options?.query), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options?.body ?? {}),
        signal: options?.signal
    });
    return handleResponse<T>(response);
}

interface QueryOptionsWithCacheId extends QueryOptions {
    cacheId?: string | number;
}

/** {@link apiPost} for a GET. */
export async function apiGet<T>(
    path: string,
    options?: QueryOptionsWithCacheId
): Promise<T> {
    const response = await fetch(
        getUrl(path, options?.query, options?.cacheId),
        {
            signal: options?.signal
        }
    );
    return handleResponse<T>(response);
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
 * Fetching here surfaces failures as a rejected query and warms the browser
 * cache. Returns the url, not a blob url, which has no safe moment to revoke.
 */
export async function loadImage(
    url: string,
    signal?: AbortSignal
): Promise<string> {
    return (await loadImageResult(url, signal)).url;
}

export interface LoadedImage {
    url: string;
    /** True when the worker served a stand-in rather than what was asked for. */
    isFallback: boolean;
}

/** {@link loadImage}, also reporting whether the worker stood something in. */
export async function loadImageResult(
    url: string,
    signal?: AbortSignal
): Promise<LoadedImage> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error("Network response failed.");
    }
    return {
        url,
        isFallback: response.headers.has(THUMBNAIL_FALLBACK_HEADER)
    };
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

/** {@link apiPost} for a DELETE. */
export async function apiDelete<T>(
    path: string,
    options?: QueryOptions
): Promise<T> {
    const response = await fetch(getUrl(path, options?.query), {
        method: "DELETE",
        signal: options?.signal
    });
    return handleResponse<T>(response);
}

/**
 * The body, or the error it describes. Asserted rather than parsed: the contract
 * is the backend's, and nothing here can check it at runtime without a schema.
 */
async function handleResponse<T>(response: Response): Promise<T> {
    const json: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
        throw fromApiErrorBody(json);
    }
    return json as T;
}

import {
    createSearchParams,
    type URLSearchParamsInit,
    type QueryOptions,
    type PostOptions
} from "@backend/lib/query-params";
import { fromApiErrorBody, ImageLoadError } from "./errors";
import { HttpStatus } from "http-status-ts";

/** Bump when an immutably cached response changes shape, or browsers keep the old one for a year. */
const RESPONSE_SHAPE = 2;

function getUrl(
    path: string,
    query?: URLSearchParamsInit,
    cacheId?: string | number
): string {
    const searchParams = createSearchParams(query);
    if (cacheId !== undefined) {
        searchParams.append("v", `${cacheId}.${RESPONSE_SHAPE}`);
    }
    return "/api" + path + `?${searchParams}`;
}

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
 * Fetched to warm the cache and surface failures; returns the url, since a
 * blob url has no safe moment to revoke. The status rides the rejection so a
 * render's 404 can be told from a refusal.
 */
export async function loadImage(
    url: string,
    signal?: AbortSignal
): Promise<string> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new ImageLoadError(response.status);
    }
    return url;
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

/** Asserted, not parsed: the backend owns the contract. */
async function handleResponse<T>(response: Response): Promise<T> {
    const json: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
        throw fromApiErrorBody(json);
    }
    return json as T;
}

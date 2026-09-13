import { HttpStatus } from "http-status-ts";
import {
    createSearchParams,
    type QueryOptions,
    type PostOptions
} from "../query-params";

// Constant across all environments (dev/cert/production), so hardcoded here
// rather than duplicated as a per-environment var in wrangler.jsonc.
const ONSHAPE_API_BASE_PATH = "https://cad.onshape.com";
const ONSHAPE_API_VERSION = 16;

function getBaseUrl(): string {
    return `${ONSHAPE_API_BASE_PATH}/api/v${ONSHAPE_API_VERSION}`;
}

export class OnshapeApiError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = "OnshapeApiError";
    }
}

/** Fallback wait when a 429 response omits (or malforms) the Retry-After header. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

/**
 * Ceiling on a single Onshape call, so a socket that never answers surfaces as a
 * retryable failure instead of being left to whatever is waiting on it. Well
 * above any call we make — a rate limit answers in milliseconds — and well under
 * the ten minutes a workflow step gets, so the step still has room to retry.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Thrown on a 429, carrying Onshape's `Retry-After` seconds so callers can wait
 * it out. Extends {@link OnshapeApiError}, so `status` handling still works.
 *
 * The wait is also spelled into the message, because the message is all that
 * survives a Workflows retry: the `delay` callback is handed an error rebuilt
 * across the RPC layer, which keeps `name` and `message` but neither the
 * prototype nor any own property. {@link readRetryAfterSeconds} reads it back.
 */
export class OnshapeRateLimitError extends OnshapeApiError {
    constructor(
        text: string,
        public readonly retryAfterSeconds: number
    ) {
        super(
            `Onshape API error 429 (retry after ${retryAfterSeconds}s): ${text}`,
            HttpStatus.TOO_MANY_REQUESTS
        );
        this.name = "OnshapeRateLimitError";
    }
}

/** Matches what {@link OnshapeRateLimitError} spells into its message. */
const RETRY_AFTER_PATTERN = /Onshape API error 429 \(retry after (\d+)s\)/;

/**
 * The seconds a 429 asked us to wait, or null when the error is not one. Reads
 * the message rather than the instance, so it answers the same for an error
 * Workflows rebuilt as for the one that was thrown.
 */
export function readRetryAfterSeconds(error: Error): number | null {
    const match = RETRY_AFTER_PATTERN.exec(error.message);
    return match ? Number.parseInt(match[1], 10) : null;
}

export abstract class OnshapeApi {
    protected readonly _baseUrl = getBaseUrl();

    protected abstract _request(
        method: string,
        url: string,
        init: RequestInit
    ): Promise<Response>;

    async get(path: string, options?: QueryOptions): Promise<any> {
        const res = await this._call("GET", path, options);
        return res.json();
    }

    async getRaw(path: string, options?: QueryOptions): Promise<Response> {
        return this._call("GET", path, options);
    }

    // Accepts any media type rather than `image/*`, matching the Python
    // implementation this was ported from, which set no Accept header at all.
    // Onshape answers a thumbnail it has not rendered yet with a JSON error,
    // which it cannot send under `image/*` — so it replies 406 rather than the
    // 404 that means "still rendering", and a caller reading status codes takes
    // a slow render for a dead one. That is my best explanation for the
    // intermittent 406s this code recorded and could not account for.
    async getImage(path: string, options?: QueryOptions): Promise<ArrayBuffer> {
        const res = await this._call("GET", path, {
            ...options,
            accept: "*/*"
        });
        return res.arrayBuffer();
    }

    async post(path: string, options?: PostOptions): Promise<any> {
        const res = await this._call("POST", path, options, options?.body);
        return res.json();
    }

    async postNone(path: string, options?: PostOptions): Promise<void> {
        await this._call("POST", path, options, options?.body);
    }

    async delete(path: string, options?: QueryOptions): Promise<any> {
        const res = await this._call("DELETE", path, options);
        return res.json();
    }

    async deleteNone(path: string, options?: QueryOptions): Promise<void> {
        await this._call("DELETE", path, options);
    }

    private async _call(
        method: string,
        path: string,
        options?: QueryOptions,
        body?: unknown
    ): Promise<Response> {
        const params = createSearchParams(options?.query);
        const url = `${this._baseUrl}${path}?${params.toString()}`;
        const headers = options?.accept
            ? new Headers({ Accept: options.accept })
            : undefined;
        const res = await this._request(method, url, {
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: options?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers
        });

        if (!res.ok) {
            const text = await res.text();
            if (res.status === HttpStatus.TOO_MANY_REQUESTS) {
                const retryAfter = parseInt(
                    res.headers.get("Retry-After") ?? "",
                    10
                );
                throw new OnshapeRateLimitError(
                    text,
                    Number.isFinite(retryAfter)
                        ? retryAfter
                        : DEFAULT_RETRY_AFTER_SECONDS
                );
            }
            throw new OnshapeApiError(
                `Onshape API error ${res.status}: ${text}`,
                res.status
            );
        }
        return res;
    }
}

export class OAuthApi extends OnshapeApi {
    private _accessToken: string;
    private readonly _refreshCallback: () => Promise<string>;

    constructor(accessToken: string, refreshCallback: () => Promise<string>) {
        super();
        this._accessToken = accessToken;
        this._refreshCallback = refreshCallback;
    }

    protected async _request(
        method: string,
        url: string,
        init: RequestInit
    ): Promise<Response> {
        const res = await fetch(url, {
            ...init,
            method,
            headers: this._makeHeaders(init.headers)
        });
        if (res.status === HttpStatus.UNAUTHORIZED) {
            this._accessToken = await this._refreshCallback();
            return fetch(url, {
                ...init,
                method,
                headers: this._makeHeaders(init.headers)
            });
        }
        return res;
    }

    private _makeHeaders(overrides?: HeadersInit): Headers {
        const headers = new Headers({
            Authorization: `Bearer ${this._accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json"
        });
        if (overrides)
            new Headers(overrides).forEach((v, k) => headers.set(k, v));
        return headers;
    }
}

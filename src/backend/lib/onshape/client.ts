import { HttpStatus } from "http-status-ts";
import {
    createSearchParams,
    type QueryOptions,
    type PostOptions
} from "../query-params";

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

/** Well under a workflow step's ten minutes, so the step can still retry. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * The wait is also in the message, since that's all that survives Workflows
 * rebuilding the error; {@link readRetryAfterSeconds} reads it back.
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

/** Reads the message, so it works on an error Workflows rebuilt. */
export function readRetryAfterSeconds(error: Error): number | undefined {
    const match = RETRY_AFTER_PATTERN.exec(error.message);
    return match ? Number.parseInt(match[1], 10) : undefined;
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

    // Any media type: under `image/*`, a thumbnail still rendering seems to come
    // back 406 instead of 404, since its JSON error can't be sent as an image.
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

/**
 * Signs with an API key pair, for scripts. Onshape verifies an HMAC over the
 * request, so the signed headers have to be the ones sent.
 */
export class ApiKeyApi extends OnshapeApi {
    constructor(
        private readonly _accessKey: string,
        private readonly _secretKey: string
    ) {
        super();
    }

    protected async _request(
        method: string,
        url: string,
        init: RequestInit
    ): Promise<Response> {
        return fetch(url, {
            ...init,
            method,
            headers: await this._makeHeaders(method, url, init.headers)
        });
    }

    private async _makeHeaders(
        method: string,
        url: string,
        overrides?: HeadersInit
    ): Promise<Headers> {
        const date = new Date().toUTCString();
        const nonce = makeNonce();
        const contentType = "application/json";
        const { pathname, search } = new URL(url);

        // Lowercased, as Onshape signs the folded form. Untested against a live key.
        const signature = await sign(
            this._secretKey,
            [
                method,
                nonce,
                date,
                contentType,
                pathname,
                search.replace(/^\?/, ""),
                ""
            ]
                .join("\n")
                .toLowerCase()
        );

        const headers = new Headers({
            Authorization: `On ${this._accessKey}:HmacSHA256:${signature}`,
            Date: date,
            "On-Nonce": nonce,
            "Content-Type": contentType,
            Accept: "application/json"
        });
        // Only `Accept` is ever overridden, and it is not part of the signature.
        if (overrides)
            new Headers(overrides).forEach((v, k) => headers.set(k, v));
        return headers;
    }
}

/** Alphanumeric and unique per request, which is all Onshape asks of it. */
function makeNonce(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(25));
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(
        ""
    );
}

async function sign(secretKey: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payload)
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

import { HttpStatus } from "http-status-ts";
import {
    createSearchParams,
    type QueryOptions,
    type PostOptions
} from "../../shared/url-params";

// Constant across all environments (dev/cert/production), so hardcoded here
// rather than duplicated as a per-environment var in wrangler.jsonc.
const ONSHAPE_API_BASE_PATH = "https://cad.onshape.com";
const ONSHAPE_API_VERSION = 16;

export function getBaseUrl(): string {
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
 * Thrown on a 429 response. Carries the Onshape `Retry-After` value (seconds)
 * so callers can wait it out. Extends {@link OnshapeApiError} (status 429) so
 * existing `status`-based handling keeps working.
 */
export class OnshapeRateLimitError extends OnshapeApiError {
    constructor(
        message: string,
        public readonly retryAfterSeconds: number
    ) {
        super(message, HttpStatus.TOO_MANY_REQUESTS);
        this.name = "OnshapeRateLimitError";
    }
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

    async getImage(path: string, options?: QueryOptions): Promise<ArrayBuffer> {
        const res = await this._call("GET", path, {
            ...options,
            accept: "image/*"
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
            signal: options?.signal,
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
                    `Onshape API error 429: ${text}`,
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

export class KeyApi extends OnshapeApi {
    private readonly _accessKey: string;
    private readonly _keyPromise: Promise<CryptoKey>;

    constructor(accessKey: string, secretKey: string) {
        super();
        this._accessKey = accessKey;
        this._keyPromise = crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secretKey),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
    }

    protected async _request(
        method: string,
        url: string,
        init: RequestInit
    ): Promise<Response> {
        const headers = await this._makeHeaders(method, url, init.headers);
        return fetch(url, { ...init, method, headers });
    }

    private async _makeHeaders(
        method: string,
        url: string,
        overrides?: HeadersInit
    ): Promise<Headers> {
        const date = new Date().toUTCString();
        const nonce = crypto.randomUUID().replace(/-/g, "");
        const parsed = new URL(url);
        const stringToSign = [
            method,
            nonce,
            date,
            "application/json",
            parsed.pathname,
            parsed.search.slice(1)
        ]
            .join("\n")
            .concat("\n")
            .toLowerCase();

        const key = await this._keyPromise;
        const sigBuf = await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(stringToSign)
        );
        const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

        const headers = new Headers({
            Date: date,
            "On-Nonce": nonce,
            Authorization: `On ${this._accessKey}:HmacSHA256:${signature}`,
            "Content-Type": "application/json",
            "User-Agent": "Onshape App",
            Accept: "application/json"
        });
        if (overrides)
            new Headers(overrides).forEach((v, k) => headers.set(k, v));
        return headers;
    }
}

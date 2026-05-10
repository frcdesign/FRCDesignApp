import ky, { HTTPError, type KyInstance, type Options } from "ky";
import { createSearchParams, URLSearchParamsInit } from "../../common/utils";

export interface OnshapeClient {
    get(path: string, options?: GetOptions): Promise<any>;
    post(path: string, options?: PostOptions): Promise<any>;
    delete(path: string, options?: DeleteOptions): Promise<any>;
}

export interface GetOptions {
    query?: URLSearchParamsInit;
    signal?: AbortSignal;
    isJson?: boolean;
}

export interface PostOptions extends GetOptions {
    body?: unknown;
}

export type DeleteOptions = GetOptions;

/**
 * Constructs the Onshape API base URL.
 * Pass `version: null` to omit the version segment.
 */
export function buildBaseUrl(
    baseUrl = "https://cad.onshape.com",
    version: number | null = 8
): string {
    let url = baseUrl + "/api";
    if (version !== null) url += `/v${version}`;
    return url;
}

export const ONSHAPE_BASE_URL = buildBaseUrl();

export function baseUrlFromEnv(): string {
    const rawUrl = process.env.API_BASE_URL;
    const rawVersion = process.env.API_VERSION;
    const version = rawVersion !== undefined ? parseInt(rawVersion) : undefined;
    return buildBaseUrl(rawUrl, version);
}

export abstract class OnshapeBaseClient implements OnshapeClient {
    private readonly _ky: KyInstance;

    constructor(kyOptions: Options, protected readonly baseUrl = ONSHAPE_BASE_URL) {
        this._ky = ky.create({
            ...kyOptions,
            hooks: {
                ...kyOptions.hooks,
                beforeError: [
                    ...(kyOptions.hooks?.beforeError ?? []),
                    async ({ error }) => {
                        if (error instanceof HTTPError) {
                            const text = await error.response.text();
                            error.message = `Onshape API error ${error.response.status}: ${text}`;
                        }
                        return error;
                    }
                ]
            }
        });
    }

    get(path: string, { query, signal, isJson = true }: GetOptions = {}): Promise<any> {
        const rp = this._ky.get(this.baseUrl + path, {
            searchParams: createSearchParams(query),
            signal
        });
        return isJson ? rp.json() : (rp as Promise<any>);
    }

    post(path: string, { query, body, signal, isJson = true }: PostOptions = {}): Promise<any> {
        const rp = this._ky.post(this.baseUrl + path, {
            json: body,
            searchParams: createSearchParams(query),
            signal
        });
        return isJson ? rp.json() : (rp as Promise<any>);
    }

    delete(path: string, { query, signal, isJson = true }: DeleteOptions = {}): Promise<any> {
        const rp = this._ky.delete(this.baseUrl + path, {
            searchParams: createSearchParams(query),
            signal
        });
        return isJson ? rp.json() : (rp as Promise<any>);
    }
}

import ky, { HTTPError, type KyInstance, type Options } from "ky";
import { env } from "cloudflare:workers";

type ParamKeyValuePair = [string, string];
type URLSearchParamsInit =
    | string
    | ParamKeyValuePair[]
    | Record<string, boolean | string | string[]>
    | URLSearchParams;

function createSearchParams(init: URLSearchParamsInit = ""): URLSearchParams {
    return new URLSearchParams(
        typeof init === "string" ||
            Array.isArray(init) ||
            init instanceof URLSearchParams
            ? init
            : Object.keys(init).reduce((memo, key) => {
                  const value = init[key as keyof typeof init];
                  return memo.concat(
                      Array.isArray(value)
                          ? value.map((v) => [key, v])
                          : [[key, (value as boolean | string).toString()]]
                  );
              }, [] as ParamKeyValuePair[])
    );
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

export function getBaseUrl(): string {
    const rawUrl = env.API_BASE_PATH ?? "https://cad.onshape.com";
    const rawVersion = env.API_VERSION;
    const version = rawVersion !== undefined ? parseInt(rawVersion) : 8;

    return `${rawUrl}/api/v${version}`;
}

export abstract class OnshapeApi {
    private readonly _ky: KyInstance;
    private readonly _baseUrl = getBaseUrl();

    constructor(kyOptions: Options) {
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

    get(
        path: string,
        { query, signal, isJson = true }: GetOptions = {}
    ): Promise<any> {
        const rp = this._ky.get(this._baseUrl + path, {
            searchParams: createSearchParams(query),
            signal
        });
        if (isJson) {
            return rp.json();
        }
        return rp;
    }

    post(
        path: string,
        { query, body, signal, isJson = true }: PostOptions = {}
    ): Promise<any> {
        const rp = this._ky.post(this._baseUrl + path, {
            json: body,
            searchParams: createSearchParams(query),
            signal
        });

        if (isJson) {
            return rp.json();
        }
        return rp;
    }

    delete(
        path: string,
        { query, signal, isJson = true }: DeleteOptions = {}
    ): Promise<any> {
        const rp = this._ky.delete(this._baseUrl + path, {
            searchParams: createSearchParams(query),
            signal
        });
        if (isJson) {
            return rp.json();
        }
        return rp;
    }
}

import ky, { HTTPError, type KyInstance, type Options } from "ky";
import {
  createSearchParams,
  URLSearchParamsInit,
} from "../../../../old/src/common/utils";

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
  const rawUrl = process.env.API_BASE_URL ?? "https://cad.onshape.com";
  const rawVersion = process.env.API_VERSION;
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
          },
        ],
      },
    });
  }

  get(
    path: string,
    { query, signal, isJson = true }: GetOptions = {},
  ): Promise<any> {
    const rp = this._ky.get(this._baseUrl + path, {
      searchParams: createSearchParams(query),
      signal,
    });
    if (isJson) {
      return rp.json();
    }
    return rp;
  }

  post(
    path: string,
    { query, body, signal, isJson = true }: PostOptions = {},
  ): Promise<any> {
    const rp = this._ky.post(this._baseUrl + path, {
      json: body,
      searchParams: createSearchParams(query),
      signal,
    });

    if (isJson) {
      return rp.json();
    }
    return rp;
  }

  delete(
    path: string,
    { query, signal, isJson = true }: DeleteOptions = {},
  ): Promise<any> {
    const rp = this._ky.delete(this._baseUrl + path, {
      searchParams: createSearchParams(query),
      signal,
    });
    if (isJson) {
      return rp.json();
    }
    return rp;
  }
}

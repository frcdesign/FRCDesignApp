type ParamKeyValuePair = [string, string];

export type URLSearchParamsInit =
    | string
    | ParamKeyValuePair[]
    | Record<string, boolean | string | string[]>
    | URLSearchParams;

export function createSearchParams(
    init: URLSearchParamsInit = ""
): URLSearchParams {
    return new URLSearchParams(
        typeof init === "string" ||
            Array.isArray(init) ||
            init instanceof URLSearchParams
            ? init
            : Object.keys(init).reduce((memo, key) => {
                  const value = init[key];
                  return memo.concat(
                      Array.isArray(value)
                          ? value.map((v) => [key, v])
                          : [[key, value.toString()]]
                  );
              }, [] as ParamKeyValuePair[])
    );
}

/**
 * Spaces as `%20` rather than `+`: Onshape reads a `+` literally, so a value
 * like `0.1524 m` would arrive as `0.1524+m`. A literal `+` is already `%2B`.
 */
export function toQueryString(init?: URLSearchParamsInit): string {
    return createSearchParams(init).toString().replaceAll("+", "%20");
}

export interface QueryOptions {
    query?: URLSearchParamsInit;
    signal?: AbortSignal;
    accept?: string;
}

export interface PostOptions extends QueryOptions {
    body?: unknown;
}

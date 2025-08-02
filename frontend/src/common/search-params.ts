export type ParamKeyValuePair = [string, string];

export type URLSearchParamsInit =
    | string
    | ParamKeyValuePair[]
    | Record<string, boolean | string | string[]>
    | URLSearchParams;

/**
 * Borrowed from react router.
 */
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

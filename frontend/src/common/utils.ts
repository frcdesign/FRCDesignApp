import { Dispatch, FormEvent } from "react";

/**
 * Capitalizes the first letter of a string and lower cases everything else.
 */
export function capitalize(val: string) {
    return val[0].toUpperCase() + val.slice(1).toLowerCase();
}

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
} /** Event handler that exposes the target element's value as a boolean. */

export function handleBooleanChange(handler: Dispatch<boolean>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).checked);
} /** Event handler that exposes the target element's value as a string. */

export function handleStringChange(handler: Dispatch<string>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).value);
} /** Event handler that exposes the target element's value as a string. */

export function handleValueChange<T>(handler: Dispatch<T>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).value as T);
}

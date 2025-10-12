import { Classes } from "@blueprintjs/core";
import { Dispatch, FormEvent, RefObject, useLayoutEffect } from "react";

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
}

/** Event handler that exposes the target element's value as a boolean. */
export function handleBooleanChange(handler: Dispatch<boolean>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).checked);
}

/** Event handler that exposes the target element's value as a string. */
export function handleStringChange(handler: Dispatch<string>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).value);
}

/** Generic event handler that exposes the target element's value. */
export function handleValueChange<T>(handler: Dispatch<T>) {
    return (event: FormEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).value as T);
}

/**
 * Adds the Interactive class to a Blueprint Section.
 */
export function useInteractiveSection(
    sectionRef: RefObject<HTMLDivElement>,
    dependencies: any[] = []
) {
    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) {
            return;
        }
        const child = section.children[0];
        child.className += " " + Classes.INTERACTIVE;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionRef, ...dependencies]);
}

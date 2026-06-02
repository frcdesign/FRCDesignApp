import { useMatch } from "@tanstack/react-router";
import { produce } from "immer";
import { Dispatch, FormEvent } from "react";

export { createSearchParams } from "../../shared/url-params";
export type {
    URLSearchParamsInit,
    ParamKeyValuePair,
    QueryOptions,
    PostOptions
} from "../../shared/url-params";

/**
 * Capitalizes the first letter of a string and lower cases everything else.
 */
export function capitalize(val: string) {
    return val[0].toUpperCase() + val.slice(1).toLowerCase();
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

type Updater<T> = (value: T | undefined) => T | undefined;

/**
 * A wrapper around Immer which can be used to update query data.
 * Unlike normal updating, you can fully mutate the value without any issues.
 */
export function getQueryUpdater<T>(recipe: (draft: T) => void): Updater<T> {
    return (value: T | undefined) => {
        if (value === undefined) return undefined;
        return produce(value, recipe);
    };
}

/**
 * Returns true if the current route is the home route, and false if it is a document route.
 */
export function useIsHome(): boolean {
    return (
        useMatch({ from: "/app/documents/", shouldThrow: false }) !== undefined
    );
}

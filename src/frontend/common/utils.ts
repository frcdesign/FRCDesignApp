import { useMatch } from "@tanstack/react-router";
import { produce } from "immer";
import { Dispatch, SyntheticEvent } from "react";
import { queryClient } from "../query-client";
import { QueryKey } from "@tanstack/react-query";

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
    return (event: SyntheticEvent<HTMLElement>) =>
        handler((event.target as HTMLInputElement).checked);
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
 * A helper which can be used to make an optimistic update to a query with the given queryKey.
 */
export async function patchQuery<T>(
    queryKey: QueryKey,
    recipe: (draft: T) => void
): Promise<void> {
    await queryClient.cancelQueries({ queryKey });
    const queryUpdater = getQueryUpdater<T>(recipe);
    queryClient.setQueryData(queryKey, queryUpdater);
}

/**
 * Returns true if the current route is the home route, and false if it is a document route.
 */
export function useIsHome(): boolean {
    return (
        useMatch({
            from: "/app/library/$libraryId/groups/",
            shouldThrow: false
        }) !== undefined
    );
}

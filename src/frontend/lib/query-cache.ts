import { produce } from "immer";
import type { QueryKey } from "@tanstack/react-query";
import { queryClient } from "./query-client";

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

import { produce } from "immer";
import type { QueryKey } from "@tanstack/react-query";
import { queryClient } from "./query-client";

type Updater<T> = (value: T | undefined) => T | undefined;

/** Immer, so a recipe can mutate the draft and still produce a new value. */
export function getQueryUpdater<T>(recipe: (draft: T) => void): Updater<T> {
    return (value: T | undefined) => {
        if (value === undefined) return undefined;
        return produce(value, recipe);
    };
}

/**
 * Shows a mutation's result before the server confirms it. There is no snapshot
 * to roll back to: callers invalidate on settle, and the refetch is the undo.
 */
export async function patchQuery<T>(
    queryKey: QueryKey,
    recipe: (draft: T) => void
): Promise<void> {
    await queryClient.cancelQueries({ queryKey });
    const queryUpdater = getQueryUpdater<T>(recipe);
    queryClient.setQueryData(queryKey, queryUpdater);
}

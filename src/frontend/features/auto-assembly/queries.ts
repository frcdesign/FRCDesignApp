import {
    keepPreviousData,
    skipToken,
    useMutation,
    useQuery
} from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useMemo } from "react";
import {
    type AssemblyJobStatus,
    type AutoAssemblyIn,
    type PickCheckIn,
    type PickCheckOut
} from "@backend/features/auto-assembly/contract";
import { type FastenerSet } from "@backend/features/auto-assembly/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { queryClient } from "../../lib/query-client";
import {
    FASTENER_SET_QUERY_KEY,
    assemblyJobQueryKey,
    pickCheckQueryKey
} from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";

/** The fasteners the library loaded, which change only when it reloads them; null before it loads them. */
export function useFastenerSetQuery() {
    return useQuery<FastenerSet | null>({
        queryKey: FASTENER_SET_QUERY_KEY,
        queryFn: () => apiGet("/auto-assembly/parts"),
        staleTime: 10 * 60 * 1000
    });
}

/** The run this assembly last started; a push says when it moves on. */
export function useAssemblyJobQuery(assembly: ElementPath | undefined) {
    const isSignedIn = useIsSignedIn();
    return useQuery<AssemblyJobStatus>({
        queryKey: assemblyJobQueryKey(assembly),
        queryFn:
            assembly && isSignedIn
                ? () =>
                      apiGet("/auto-assembly/job", {
                          query: {
                              documentId: assembly.documentId,
                              instanceId: assembly.instanceId,
                              elementId: assembly.elementId
                          }
                      })
                : skipToken,
        staleTime: Infinity
    });
}

/** Starts a run; it carries on whether or not anybody stays on the page. */
export function useInsertMutation(assembly: ElementPath) {
    return useMutation({
        mutationKey: ["auto-assembly-insert", assembly],
        mutationFn: (body: AutoAssemblyIn) =>
            apiPost<AssemblyJobStatus>("/auto-assembly/insert", { body }),
        onSuccess: (status) =>
            queryClient.setQueryData(assemblyJobQueryKey(assembly), status),
        onError: getAppErrorHandler("Unexpectedly failed to start inserting.")
    });
}

/** Long enough that picking several in a row checks them once. */
const PICK_CHECK_DELAY_MS = 600;

/**
 * Each pick's problem by its row key, checked in the background once the
 * picks settle; each check reads the assembly in Onshape. Memoize `body`.
 */
export function usePickProblems(
    body: PickCheckIn | undefined
): Map<string, string> {
    const isSignedIn = useIsSignedIn();
    const [settled] = useDebouncedValue(body, PICK_CHECK_DELAY_MS);
    const { data } = useQuery<PickCheckOut>({
        queryKey: pickCheckQueryKey(settled),
        queryFn:
            settled && isSignedIn
                ? () => apiPost("/auto-assembly/check", { body: settled })
                : skipToken,
        // The last check's marks stay while the next is going
        placeholderData: keepPreviousData,
        staleTime: Infinity,
        retry: false
    });
    return useMemo(
        () =>
            new Map(
                (data?.problems ?? []).map((problem) => [
                    problem.key,
                    problem.message
                ])
            ),
        [data]
    );
}

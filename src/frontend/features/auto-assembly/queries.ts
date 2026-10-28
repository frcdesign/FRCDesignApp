import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
    type AssemblyJobStatus,
    type AutoAssemblyIn
} from "@backend/features/auto-assembly/contract";
import { type FastenerSet } from "@backend/features/auto-assembly/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { queryClient } from "../../lib/query-client";
import {
    FASTENER_SET_QUERY_KEY,
    assemblyJobQueryKey
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

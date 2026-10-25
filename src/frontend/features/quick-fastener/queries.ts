import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
    type FastenerJobStatus,
    type QuickFastenerIn
} from "@backend/features/quick-fastener/contract";
import { type FastenerSet } from "@backend/features/quick-fastener/studios";
import { type ElementPath } from "@backend/lib/onshape/path";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { queryClient } from "../../lib/query-client";
import {
    FASTENER_SET_QUERY_KEY,
    fastenerJobQueryKey
} from "../../lib/query-keys";
import { useIsSignedIn } from "../auth/access-level";

/** The fasteners the library loaded, which change only when it reloads them; null before it loads them. */
export function useFastenerSetQuery() {
    return useQuery<FastenerSet | null>({
        queryKey: FASTENER_SET_QUERY_KEY,
        queryFn: () => apiGet("/quick-fastener/parts"),
        staleTime: 10 * 60 * 1000
    });
}

/** The run this assembly last started; a push says when it moves on. */
export function useFastenerJobQuery(assembly: ElementPath | undefined) {
    const isSignedIn = useIsSignedIn();
    return useQuery<FastenerJobStatus>({
        queryKey: fastenerJobQueryKey(assembly),
        queryFn:
            assembly && isSignedIn
                ? () =>
                      apiGet("/quick-fastener/job", {
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
        mutationKey: ["quick-fastener-insert", assembly],
        mutationFn: (body: QuickFastenerIn) =>
            apiPost<FastenerJobStatus>("/quick-fastener/insert", { body }),
        onSuccess: (status) =>
            queryClient.setQueryData(fastenerJobQueryKey(assembly), status),
        onError: getAppErrorHandler("Unexpectedly failed to start inserting.")
    });
}

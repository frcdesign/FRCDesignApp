import { useEffect, useMemo } from "react";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { ElementType } from "@backend/lib/onshape/element-type";
import { type InsertLocationOut } from "@backend/features/insert-location/contract";
import { type TargetElement } from "../../lib/onshape-launch";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { useTargetElement } from "../../lib/onshape-params";
import { useIsSignedIn } from "../auth/access-level";
import { queryClient } from "../../lib/query-client";
import { insertLocationQueryKey } from "../../lib/query-keys";
import { m } from "../../paraglide/messages";

/** Only an assembly has one; a derive places itself. */
export function useInsertLocationTarget(): TargetElement | undefined {
    const target = useTargetElement();
    return target?.elementType === ElementType.ASSEMBLY ? target : undefined;
}

/** How old an answer has to be before the panel regaining focus asks again. */
const REFETCH_ON_FOCUS_AFTER_MS = 30 * 1000;

/**
 * Asked when the app opens, and again when the panel regains focus, since the
 * marker may have been deleted in Onshape meanwhile; the add mutation updates it.
 */
export function useInsertLocationQuery(target: TargetElement | undefined) {
    // Idle while signed out rather than answering 401.
    const isSignedIn = useIsSignedIn();
    const queryKey = useMemo(() => insertLocationQueryKey(target), [target]);

    // TanStack refetches on visibility alone, which clicking from Onshape into the panel never changes
    useEffect(() => {
        const refetchIfOld = () => {
            const state = queryClient.getQueryState(queryKey);
            if (
                state?.status === "success" &&
                Date.now() - state.dataUpdatedAt > REFETCH_ON_FOCUS_AFTER_MS
            ) {
                void queryClient.refetchQueries(
                    { queryKey, exact: true },
                    { cancelRefetch: false }
                );
            }
        };
        window.addEventListener("focus", refetchIfOld);
        return () => window.removeEventListener("focus", refetchIfOld);
    }, [queryKey]);

    return useQuery<InsertLocationOut>({
        queryKey,
        queryFn:
            target && isSignedIn
                ? () =>
                      apiGet("/insert-location", {
                          query: {
                              documentId: target.documentId,
                              instanceId: target.instanceId,
                              instanceType: target.instanceType,
                              elementId: target.elementId
                          }
                      })
                : skipToken,
        refetchInterval: false
    });
}

/** The marker the insert should land on, or nothing when there is none. */
export function useInsertLocationId(): string | undefined {
    const target = useInsertLocationTarget();
    return useInsertLocationQuery(target).data?.instanceId;
}

/** Where a new part lands in the open assembly. */
export interface InsertLocation {
    target: TargetElement;
    /** The marker's instance, or nothing when the assembly has none. */
    instanceId?: string;
}

/** Undefined outside an assembly, and until the answer is in. */
export function useInsertLocation(): InsertLocation | undefined {
    const target = useInsertLocationTarget();
    const { data, isPending, isError } = useInsertLocationQuery(target);
    return useMemo(
        () =>
            !target || isPending || isError
                ? undefined
                : { target, instanceId: data?.instanceId },
        [target, isPending, isError, data?.instanceId]
    );
}

/** Adds the connector to the assembly, and takes the answer as the new state. */
export function useAddInsertLocationMutation(target: TargetElement) {
    return useMutation({
        mutationKey: ["add-insert-location"],
        mutationFn: () =>
            apiPost<InsertLocationOut>("/insert-location", {
                body: { targetPath: target }
            }),
        // The button that added it shows it added
        onSuccess: (result) =>
            queryClient.setQueryData(insertLocationQueryKey(target), result),
        onError: getAppErrorHandler(m.insertLocationAddFailed())
    });
}

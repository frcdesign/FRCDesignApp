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
import { showSuccessToast } from "../../lib/notifications";

/** Only an assembly has one; a derive places itself. */
export function useInsertLocationTarget(): TargetElement | undefined {
    const target = useTargetElement();
    return target?.elementType === ElementType.ASSEMBLY ? target : undefined;
}

/** Asked once when the app opens; the add mutation updates it. */
export function useInsertLocationQuery(target: TargetElement | undefined) {
    // Idle while signed out rather than answering 401.
    const isSignedIn = useIsSignedIn();
    return useQuery<InsertLocationOut>({
        queryKey: insertLocationQueryKey(target),
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

/** Adds the connector to the assembly, and takes the answer as the new state. */
export function useAddInsertLocationMutation(target: TargetElement) {
    return useMutation({
        mutationKey: ["add-insert-location"],
        mutationFn: () =>
            apiPost<InsertLocationOut>("/insert-location", {
                body: { targetPath: target }
            }),
        onSuccess: (result) => {
            queryClient.setQueryData(insertLocationQueryKey(target), result);
            showSuccessToast("Added an insert location.");
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to add an insert location."
        )
    });
}

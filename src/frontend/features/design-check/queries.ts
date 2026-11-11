import { skipToken, useQuery } from "@tanstack/react-query";
import { type DesignCheckOut } from "@backend/features/design-check/contract";
import { apiGet } from "../../lib/api-client";
import { type TargetElement } from "../../lib/onshape-launch";
import { designCheckQueryKey } from "../../lib/query-keys";
import { queryClient } from "../../lib/query-client";
import { useIsSignedIn } from "../auth/access-level";

/**
 * A check runs when the page opens on a workspace with none cached and when
 * asked again, never on its own, so it never runs while someone is editing.
 */
export function useDesignCheckQuery(target: TargetElement | undefined) {
    const isSignedIn = useIsSignedIn();
    return useQuery<DesignCheckOut>({
        queryKey: target ? designCheckQueryKey(target) : ["design-check"],
        queryFn:
            target && isSignedIn
                ? () =>
                      apiGet("/design-check", {
                          query: {
                              documentId: target.documentId,
                              instanceId: target.instanceId
                          }
                      })
                : skipToken,
        staleTime: Infinity,
        retry: false
    });
}

export function checkAgain(target: TargetElement): Promise<void> {
    return queryClient.refetchQueries({
        queryKey: designCheckQueryKey(target),
        exact: true
    });
}

import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import {
    type DesignCheckLevelsOut,
    type DesignCheckOut,
    type DesignIssueLevel,
    type DesignIssueLevels,
    type DesignIssueType,
    getDesignIssueSeverity
} from "@backend/features/design-check/contract";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { type TargetElement } from "../../lib/onshape-launch";
import {
    designCheckLevelsQueryKey,
    designCheckQueryKey
} from "../../lib/query-keys";
import { queryClient } from "../../lib/query-client";
import { m } from "../../paraglide/messages";
import { useIsSignedIn } from "../auth/access-level";

/**
 * Each check spends Onshape calls, so it runs when the page opens on a tab
 * with none cached and when asked again, never on its own.
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
                              instanceId: target.instanceId,
                              elementId: target.elementId,
                              elementType: target.elementType
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

/** The caller's levels, which change only from here, so they are never stale. */
export function useDesignCheckLevelsQuery() {
    const isSignedIn = useIsSignedIn();
    return useQuery<DesignCheckLevelsOut>({
        queryKey: designCheckLevelsQueryKey(),
        queryFn: isSignedIn ? () => apiGet("/design-check/levels") : skipToken,
        staleTime: Infinity
    });
}

/** `levels` with `type` at `level`; FRCDesign's own is left out, so it follows any change to it. */
export function withLevel(
    levels: DesignIssueLevels,
    type: DesignIssueType,
    level: DesignIssueLevel
): DesignIssueLevels {
    const next = { ...levels, [type]: level };
    if (level === getDesignIssueSeverity(type)) {
        delete next[type];
    }
    return next;
}

/** Saves all of the caller's levels, shown before the server confirms. */
export function useSaveDesignCheckLevelsMutation() {
    const queryKey = designCheckLevelsQueryKey();
    return useMutation({
        mutationKey: ["save-design-check-levels"],
        mutationFn: (levels: DesignIssueLevels) =>
            apiPost<DesignCheckLevelsOut>("/design-check/levels", {
                body: { levels }
            }),
        onMutate: async (levels) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData<DesignCheckLevelsOut>(queryKey, {
                levels
            });
        },
        onError: getAppErrorHandler(m.designCheckLevelsFailed()),
        onSettled: () => queryClient.invalidateQueries({ queryKey })
    });
}

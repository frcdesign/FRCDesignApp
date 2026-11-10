import {
    skipToken,
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query";
import {
    type DesignCheckLevelsOut,
    type DesignCheckOut,
    type DesignIssueLevel,
    type DesignIssueLevels,
    type DesignIssueType,
    getDefaultLevel
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
        staleTime: Infinity,
        // The page waits on them, and FRCDesign's stand in when they fail.
        retry: false
    });
}

/** `levels` with `type` at `level`; FRCDesign's own is left out, so it follows any change to it. */
export function withLevel(
    levels: DesignIssueLevels,
    type: DesignIssueType,
    level: DesignIssueLevel
): DesignIssueLevels {
    const next = { ...levels, [type]: level };
    if (level === getDefaultLevel(type)) {
        delete next[type];
    }
    return next;
}

const SAVE_LEVELS_KEY = ["save-design-check-levels"];

/**
 * Saves all of the caller's levels, shown before the server confirms. Saves
 * run one at a time, so the server keeps the last pick, and the levels are
 * read back only once none is waiting.
 */
export function useSaveDesignCheckLevelsMutation() {
    const client = useQueryClient();
    const queryKey = designCheckLevelsQueryKey();
    const showError = getAppErrorHandler(m.designCheckLevelsFailed());
    return useMutation({
        mutationKey: SAVE_LEVELS_KEY,
        scope: { id: SAVE_LEVELS_KEY.join() },
        mutationFn: (levels: DesignIssueLevels) =>
            apiPost<DesignCheckLevelsOut>("/design-check/levels", {
                body: { levels }
            }),
        onMutate: async (levels) => {
            await client.cancelQueries({ queryKey });
            const previous =
                client.getQueryData<DesignCheckLevelsOut>(queryKey);
            client.setQueryData<DesignCheckLevelsOut>(queryKey, {
                levels
            });
            return { previous };
        },
        onError: (error, _levels, saved) => {
            if (saved?.previous) {
                client.setQueryData(queryKey, saved.previous);
            }
            showError(error);
        },
        onSettled: async () => {
            // This save still counts as one in flight.
            if (client.isMutating({ mutationKey: SAVE_LEVELS_KEY }) === 1) {
                await client.invalidateQueries({ queryKey });
            }
        }
    });
}

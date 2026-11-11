import {
    skipToken,
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query";
import {
    type DesignCheckOut,
    type DesignDismissIn,
    type DesignFixIn,
    getIssueKey
} from "@backend/features/design-check/contract";
import { apiGet, apiPost } from "../../lib/api-client";
import { getAppErrorHandler } from "../../lib/errors";
import { type TargetElement } from "../../lib/onshape-launch";
import { designCheckQueryKey } from "../../lib/query-keys";
import { queryClient } from "../../lib/query-client";
import { m } from "../../paraglide/messages";
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

/**
 * Makes each fix in turn, stopping at the first Onshape refuses, then checks
 * the document again, which reads again only the tabs the fixes changed.
 */
export function useApplyFixesMutation(target: TargetElement) {
    const client = useQueryClient();
    return useMutation({
        mutationKey: ["design-check-fix"],
        mutationFn: async (fixes: DesignFixIn[]) => {
            for (const fix of fixes) {
                await apiPost("/design-check/fix", { body: fix });
            }
        },
        onError: getAppErrorHandler(m.designCheckFixFailed()),
        onSettled: () =>
            client.refetchQueries({
                queryKey: designCheckQueryKey(target),
                exact: true
            })
    });
}

/**
 * Shows the issue dismissed, or put back, at once, and the server agrees
 * later: checking again would read the whole document over.
 */
export function useDismissMutation(target: TargetElement) {
    const client = useQueryClient();
    const queryKey = designCheckQueryKey(target);
    const handleError = getAppErrorHandler(m.designCheckDismissFailed());
    return useMutation({
        mutationKey: ["design-check-dismiss"],
        mutationFn: (request: DesignDismissIn) =>
            apiPost("/design-check/dismiss", { body: request }),
        onMutate: async (request) => {
            await client.cancelQueries({ queryKey, exact: true });
            const before = client.getQueryData<DesignCheckOut>(queryKey);
            client.setQueryData<DesignCheckOut>(
                queryKey,
                (check) => check && withDismissed(check, request)
            );
            return { before };
        },
        onError: (error, _request, context) => {
            client.setQueryData(queryKey, context?.before);
            handleError(error);
        }
    });
}

function withDismissed(
    check: DesignCheckOut,
    request: DesignDismissIn
): DesignCheckOut {
    return {
        ...check,
        tabs: check.tabs.map((tab) =>
            tab.elementId !== request.elementId
                ? tab
                : {
                      ...tab,
                      issues: tab.issues.map((issue) =>
                          getIssueKey(issue) === request.issueKey
                              ? { ...issue, dismissed: request.dismissed }
                              : issue
                      )
                  }
        )
    };
}

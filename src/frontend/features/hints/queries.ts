import { useCallback } from "react";
import { type AccessData } from "@backend/features/auth/access-level";
import { type Hint } from "@backend/features/hints/contract";
import { useAccessData } from "../auth/access-level";
import { apiPost } from "../../lib/api-client";
import { queryClient } from "../../lib/query-client";
import { accessDataQueryKey } from "../../lib/query-keys";

/** Seen while the answer is pending, so a dot never shows and then vanishes. */
export function useHasSeenHint(hint: Hint): boolean {
    const { seenHints, isPending } = useAccessData();
    return isPending || seenHints.includes(hint);
}

/**
 * Stops pointing a feature out, for once it has been opened: here at once, and
 * on every computer when signed in. A no-op until access is known, or once seen.
 */
export function useMarkHintSeen(hint: Hint): () => void {
    const { seenHints, signedIn, isPending } = useAccessData();
    return useCallback(() => {
        if (isPending || seenHints.includes(hint)) {
            return;
        }
        hideHint(hint);
        if (signedIn) {
            // Losing it only shows the dot again.
            void apiPost("/seen-hints", { body: { hint } }).catch(
                () => undefined
            );
        }
    }, [hint, seenHints, signedIn, isPending]);
}

function hideHint(hint: Hint): void {
    queryClient.setQueriesData<AccessData>(
        { queryKey: accessDataQueryKey() },
        (data) =>
            data && !data.seenHints.includes(hint)
                ? { ...data, seenHints: [...data.seenHints, hint] }
                : data
    );
}

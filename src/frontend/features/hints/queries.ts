import { type AccessData } from "@backend/features/auth/access-level";
import { type Hint } from "@backend/features/hints/contract";
import { useAccessData } from "../auth/access-level";
import { queryClient } from "../../lib/query-client";
import { accessDataQueryKey } from "../../lib/query-keys";

/** Seen while the answer is pending, so a dot never shows and then vanishes. */
export function useHasSeenHint(hint: Hint): boolean {
    const { seenHints, isPending } = useAccessData();
    return isPending || seenHints.includes(hint);
}

/** What the server records as a side effect of the same request, shown now. */
export function markHintSeen(hint: Hint): void {
    queryClient.setQueriesData<AccessData>(
        { queryKey: accessDataQueryKey() },
        (data) =>
            data && !data.seenHints.includes(hint)
                ? { ...data, seenHints: [...data.seenHints, hint] }
                : data
    );
}

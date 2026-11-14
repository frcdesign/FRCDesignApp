import { useCallback } from "react";
import { type Hint } from "@backend/features/hints/contract";
import { useAccessData } from "../auth/access-level";
import { apiPost } from "../../lib/api-client";
import { updateUiState, getUiState, useUiState } from "../../lib/ui-state";

/** Seen while the answer is pending, so a dot never shows and then vanishes; and signed out. */
export function useHasSeenHint(hint: Hint): boolean {
    const { seenHints, signedIn, isPending } = useAccessData();
    const seenHere = useUiState((state) => state.seenHints.includes(hint));
    return isPending || !signedIn || seenHere || seenHints.includes(hint);
}

/**
 * Stops pointing a feature out, for once it has been opened: in this browser at
 * once, and on every computer when signed in. A no-op until access is known, or once seen.
 */
export function useMarkHintSeen(hint: Hint): () => void {
    const { seenHints, signedIn, isPending } = useAccessData();
    const seenHere = useUiState((state) => state.seenHints.includes(hint));
    return useCallback(() => {
        if (isPending || seenHere || seenHints.includes(hint)) {
            return;
        }
        updateUiState({ seenHints: [...getUiState().seenHints, hint] });
        if (signedIn) {
            // Losing it only shows the dot on another computer.
            void apiPost("/seen-hints", { body: { hint } }).catch(
                () => undefined
            );
        }
    }, [hint, seenHere, seenHints, signedIn, isPending]);
}

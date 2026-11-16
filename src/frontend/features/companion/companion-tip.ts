import { Hint } from "@backend/features/hints/contract";
import { useCallback } from "react";
import { renderNotification, showTipToast } from "../../lib/notifications";
import { getUiState, updateUiState } from "../../lib/ui-state";
import { m } from "../../paraglide/messages";
import { useHasSeenHint } from "../hints/queries";
import {
    openCompanionStore,
    useCanUseCompanion,
    useCompanion
} from "./connection";

/** Somebody who hasn't got it after this many has a reason not to. */
const MAX_COMPANION_TIPS = 3;

/** Once a page load at most, so it never follows a string of inserts around. */
let shownThisLoad = false;

/** After an insert, until the Companion has connected on any computer. */
export function useCompanionTip(): () => void {
    const canUse = useCanUseCompanion();
    const hasConnected = useHasSeenHint(Hint.CONNECTED_COMPANION);
    return useCallback(() => {
        const shown = getUiState().companionTipCount;
        if (
            !canUse ||
            hasConnected ||
            useCompanion.getState().isConnected ||
            shownThisLoad ||
            shown >= MAX_COMPANION_TIPS
        ) {
            return;
        }
        shownThisLoad = true;
        updateUiState({ companionTipCount: shown + 1 });
        showTipToast(
            renderNotification(m.companionTip(), {
                text: m.companionTipAction(),
                onClick: () => openCompanionStore()
            }),
            "companion-tip"
        );
    }, [canUse, hasConnected]);
}

/** For tests, which share a module. */
export function resetCompanionTip(): void {
    shownThisLoad = false;
}

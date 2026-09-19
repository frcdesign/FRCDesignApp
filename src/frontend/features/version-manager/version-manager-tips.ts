import { LinkDirection } from "@backend/features/version-manager/contract";
import { showInfoToast } from "../../lib/notifications";
import { getUiState, updateUiState } from "../../lib/ui-state";

/** Long enough to read, short enough not to follow them around. */
const TIP_AUTO_CLOSE_MS = 8000;

/**
 * How many times the tip may be offered before it stops. Somebody who keeps
 * taking the form's defaults after three reminders is telling us they would
 * rather have the form.
 */
const MAX_TIPS = 3;

const TIP_TEXT = {
    [LinkDirection.CHILD]:
        "Tip: the Push buttons push straight away, without opening this form.",
    [LinkDirection.PARENT]:
        "Tip: the Pull buttons pull straight away, without opening this form."
} as const;

/**
 * Points out the shortcut to somebody whose last run did not need the form:
 * they opened it, changed nothing, and ran what the button would have run.
 *
 * Quiet after {@link MAX_TIPS}, and silent from the moment they take the
 * shortcut themselves — see {@link retireQuickActionTip}.
 */
export function showQuickActionTip(direction: LinkDirection): void {
    const shown = getUiState().quickActionTipCount;
    if (shown >= MAX_TIPS) {
        return;
    }
    updateUiState({ quickActionTipCount: shown + 1 });
    showInfoToast(TIP_TEXT[direction], {
        id: "quick-version-action-tip",
        autoClose: TIP_AUTO_CLOSE_MS
    });
}

/** Called when a quick action runs: they have found it, so the tip is done. */
export function retireQuickActionTip(): void {
    if (getUiState().quickActionTipCount < MAX_TIPS) {
        updateUiState({ quickActionTipCount: MAX_TIPS });
    }
}

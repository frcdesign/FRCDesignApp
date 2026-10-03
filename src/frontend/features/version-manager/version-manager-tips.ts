import { LinkDirection } from "@backend/features/version-manager/contract";
import { showTipToast } from "../../lib/notifications";
import { getUiState, updateUiState } from "../../lib/ui-state";

/** Somebody still taking the form's defaults after this many would rather have the form. */
const MAX_TIPS = 3;

/** Worded as the library's quick-insert tip is. */
const TIP_TEXT = {
    [LinkDirection.CHILD]: "push to it without opening the push menu.",
    [LinkDirection.PARENT]: "pull from it without opening the pull menu."
} as const;

/**
 * The click that runs a row's action without its form. On a Mac ctrl-click is
 * the context menu, so the command key is what a Mac reads instead.
 */
export function quickClickName(): string {
    return navigator.userAgent.includes("Mac") ? "⌘-click" : "ctrl-click";
}

/** For somebody who opened the form, changed nothing, and ran what a modified click runs. */
export function showQuickActionTip(direction: LinkDirection): void {
    const shown = getUiState().quickActionTipCount;
    if (shown >= MAX_TIPS) {
        return;
    }
    updateUiState({ quickActionTipCount: shown + 1 });
    showTipToast(
        `Tip: ${quickClickName()} a document to ${TIP_TEXT[direction]}`,
        "quick-version-action-tip"
    );
}

/** Called when a quick action runs: they have found it, so the tip is done. */
export function retireQuickActionTip(): void {
    if (getUiState().quickActionTipCount < MAX_TIPS) {
        updateUiState({ quickActionTipCount: MAX_TIPS });
    }
}

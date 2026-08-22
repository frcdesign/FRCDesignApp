import { showInfoToast } from "../../lib/notifications";
import { getUiState, updateUiState } from "../../lib/ui-state";

/**
 * After an insert that changed nothing in the menu, points out that a
 * right-click would have done it. Once only: the menu is a fine way to work.
 */
export function showQuickInsertTip(): void {
    if (getUiState().hasSeenQuickInsertTip) {
        return;
    }
    updateUiState({ hasSeenQuickInsertTip: true });
    showInfoToast(
        "Tip: right-click an item to insert it without opening this menu.",
        { id: "quick-insert-tip", autoClose: 8000 }
    );
}

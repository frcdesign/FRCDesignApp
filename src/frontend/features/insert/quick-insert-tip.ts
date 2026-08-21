import { showInfoToast } from "../../lib/notifications";
import { getUiState, updateUiState } from "../../lib/ui-state";

/**
 * Points out the faster route after an insert that changed nothing in the menu:
 * the same insert was one right-click away. Shown only once, since someone who
 * wants the menu should not be told off for using it.
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

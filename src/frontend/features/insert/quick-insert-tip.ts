import { showInfoToast } from "../../lib/notifications";

/** An insert this soon after opening didn't need anything from the menu. */
const QUICK_INSERT_WINDOW_MS = 1500;

/**
 * After an insert that changed nothing in the menu, points out that a
 * right-click would have done it. Only when the menu was dismissed as fast as
 * a right-click: a slower one was spent looking at the part, which the tip
 * has no better answer for.
 */
export function showQuickInsertTip(openedAt: number): void {
    if (Date.now() - openedAt >= QUICK_INSERT_WINDOW_MS) {
        return;
    }
    showInfoToast(
        "Tip: right-click a part to insert it without opening the insert menu.",
        { id: "quick-insert-tip", autoClose: 8000 }
    );
}

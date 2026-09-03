import { showInfoToast } from "../../lib/notifications";

/** An insert this soon after opening didn't need anything from the menu. */
const QUICK_INSERT_WINDOW_MS = 1500;

/**
 * Points out that a right-click would have done it — only when the menu was
 * dismissed that fast, a slower one having been spent looking at the part.
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

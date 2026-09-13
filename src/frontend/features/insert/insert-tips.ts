import { showInfoToast } from "../../lib/notifications";

/** An insert this soon after opening didn't need anything from the menu. */
const QUICK_INSERT_WINDOW_MS = 1500;

/**
 * How long in the menu counts as having sat through the render. Half the window
 * the preview itself gives up after, so this is someone who watched the spinner
 * rather than someone who took their time over the parameters.
 */
const THUMBNAIL_WAIT_MS = 15000;

/** Long enough to read, short enough not to follow them around. */
const TIP_AUTO_CLOSE_MS = 8000;

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
        { id: "quick-insert-tip", autoClose: TIP_AUTO_CLOSE_MS }
    );
}

/**
 * Points out that the render was never what the insert was waiting on — only
 * for someone who waited on one anyway, which is who would not know.
 */
export function showThumbnailWaitTip(
    openedAt: number,
    isThumbnailRendering: boolean
): void {
    if (!isThumbnailRendering || Date.now() - openedAt < THUMBNAIL_WAIT_MS) {
        return;
    }
    showInfoToast(
        "Tip: you can insert a part even while the part's thumbnail is still generating.",
        { id: "thumbnail-wait-tip", autoClose: TIP_AUTO_CLOSE_MS }
    );
}

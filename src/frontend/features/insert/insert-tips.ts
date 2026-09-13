import { useEffect } from "react";
import { showInfoToast } from "../../lib/notifications";
import { useIsThumbnailRendering } from "../thumbnails/queries";
import { useIsConnectedToOnshape } from "../../lib/onshape-params";

/** An insert this soon after opening didn't need anything from the menu. */
const QUICK_INSERT_WINDOW_MS = 1500;

/**
 * How long a render has to keep the menu waiting before the wait is worth
 * naming. Half the window the preview itself gives up after, so this reaches
 * someone mid-spinner rather than someone who merely took their time.
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
 * Points out, while they are still waiting, that the render was never what the
 * insert needed. Raised on a timer rather than at the click: by the time
 * somebody gives up and inserts they have already spent the wait, and telling
 * them then is too late to save it.
 *
 * The timer restarts whenever a render does, so this is fifteen seconds on one
 * selection rather than fifteen spread across several.
 */
export function useThumbnailWaitTip(): void {
    const isRendering = useIsThumbnailRendering();
    // Standalone has no insert button for the tip to point at.
    const isConnected = useIsConnectedToOnshape();

    useEffect(() => {
        if (!isRendering || !isConnected) {
            return;
        }
        const timer = setTimeout(() => {
            showInfoToast(
                "Tip: you can insert a part even while the part's thumbnail is still generating.",
                { id: "thumbnail-wait-tip", autoClose: TIP_AUTO_CLOSE_MS }
            );
        }, THUMBNAIL_WAIT_MS);
        return () => clearTimeout(timer);
    }, [isRendering, isConnected]);
}

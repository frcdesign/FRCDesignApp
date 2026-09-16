import { useEffect } from "react";
import { renderNotification, showInfoToast } from "../../lib/notifications";
import { useIsThumbnailRendering } from "../thumbnails/queries";
import { useIsConnectedToOnshape } from "../../lib/onshape-params";
import { useAccessData } from "../auth/access-level";
import { startSignIn } from "../auth/sign-in";

/** An insert this soon after opening didn't need anything from the menu. */
export const QUICK_INSERT_WINDOW_MS = 1500;

/**
 * How long a render has to keep the menu waiting before the wait is worth
 * naming. Half the window the preview itself gives up after, so this reaches
 * someone mid-spinner rather than someone who merely took their time.
 */
const THUMBNAIL_WAIT_MS = 15000;

/** Long enough to read, short enough not to follow them around. */
const TIP_AUTO_CLOSE_MS = 8000;

/** Points out that a right-click would have done it; the menu decides when. */
export function showQuickInsertTip(): void {
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

/**
 * Points out to a signed-out viewer that the preview has stopped following
 * them: with no Onshape session the box falls back to the stored thumbnail of
 * the default. Raised on the first change, not on opening, where they agree.
 */
export function useSignInPreviewTip(isSelectionEdited: boolean): void {
    const { signedIn, isPending } = useAccessData();

    useEffect(() => {
        // Pending reads as signed out, which would prompt a signed-in caller.
        if (isPending || signedIn || !isSelectionEdited) {
            return;
        }
        showInfoToast(
            renderNotification(
                "Sign in to Onshape to see a preview of your selection.",
                { text: "Sign in", onClick: startSignIn }
            ),
            { id: "sign-in-preview", autoClose: TIP_AUTO_CLOSE_MS }
        );
    }, [signedIn, isPending, isSelectionEdited]);
}

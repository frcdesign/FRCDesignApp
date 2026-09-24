import { useEffect } from "react";
import { type ConfigurationKey } from "@backend/features/configurations/contract";
import { renderNotification, showInfoToast } from "../../lib/notifications";
import { useIsThumbnailRendering } from "../thumbnails/queries";
import { useIsConnectedToOnshape } from "../../lib/onshape-params";
import { useAccessData } from "../auth/access-level";
import { startSignIn } from "../auth/sign-in";

/** An insert this soon after opening didn't need anything from the menu. */
export const QUICK_INSERT_WINDOW_MS = 1500;

/** Half the preview's timeout, to catch someone mid-spinner. */
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
 * Tells someone waiting that inserting doesn't need the render. On a timer,
 * since by the time they insert the wait is spent; it restarts with each configuration.
 */
export function useThumbnailWaitTip(configurationKey: ConfigurationKey): void {
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
    }, [isRendering, isConnected, configurationKey]);
}

/**
 * Signed out, the preview stays on the default's stored thumbnail, so say so
 * on the first change.
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

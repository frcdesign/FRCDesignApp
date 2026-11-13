import { useEffect } from "react";
import { type ConfigurationKey } from "@backend/features/configurations/contract";
import { renderNotification, showTipToast } from "../../lib/notifications";
import { useIsThumbnailRendering } from "../thumbnails/queries";
import { useIsConnectedToOnshape } from "../../lib/onshape-params";
import { useAccessData } from "../auth/access-level";
import { startSignIn } from "../auth/sign-in";
import { m } from "../../paraglide/messages";
import { ElementType } from "@backend/lib/onshape/element-type";

/** An insert this soon after opening didn't need anything from the menu. */
export const QUICK_INSERT_WINDOW_MS = 1500;

/** Half the preview's timeout, to catch someone mid-spinner. */
const THUMBNAIL_WAIT_MS = 15000;

/** Points out that the row's own button would have done it; the menu decides when. */
export function showQuickInsertTip(targetElementType: ElementType): void {
    showTipToast(
        targetElementType === ElementType.ASSEMBLY
            ? m.insertQuickInsertTip()
            : m.insertQuickDeriveTip(),
        "quick-insert-tip"
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
            showTipToast(m.insertThumbnailWaitTip(), "thumbnail-wait-tip");
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
        showTipToast(
            renderNotification(m.insertSignInPreviewTip(), {
                text: m.insertSignIn(),
                onClick: startSignIn
            }),
            "sign-in-preview"
        );
    }, [signedIn, isPending, isSelectionEdited]);
}

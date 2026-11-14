import { useEffect } from "react";
import { type ConfigurationKey } from "@backend/features/configurations/contract";
import { renderNotification, showTipToast } from "../../lib/notifications";
import { useIsThumbnailRendering } from "../thumbnails/queries";
import { useIsConnectedToOnshape } from "../../lib/onshape-params";
import { useAccessData } from "../auth/access-level";
import { startSignIn } from "../auth/sign-in";
import { m } from "../../paraglide/messages";

/** Half the preview's timeout, to catch someone mid-spinner. */
const THUMBNAIL_WAIT_MS = 15000;

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

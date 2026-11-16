/** The preview extension, in the Onshape page the panel is in, when it's installed. */
import {
    parsePreviewReady,
    PREVIEW_PROTOCOL_VERSION,
    PREVIEW_SOURCE,
    type PreviewRequest
} from "@backend/features/previews/contract";
import { useEffect } from "react";
import { create } from "zustand";
import { useOnshapeServer } from "../../lib/onshape-params";

interface PreviewExtensionState {
    /** Whether it answered, in this protocol's version. */
    isReady: boolean;
}

export const usePreviewExtension = create<PreviewExtensionState>(() => ({
    isReady: false
}));

/** Posted to the Onshape page; meshes are copied, so the query cache keeps its own. */
export function postToPreviewExtension(
    server: string,
    request: PreviewRequest
) {
    window.parent.postMessage(request, server);
}

/** Asks the Onshape page for the extension once a launch names it; from the app shell. */
export function usePreviewHandshake() {
    const server = useOnshapeServer();

    useEffect(() => {
        if (!server || window.parent === window) {
            return;
        }
        const handleMessage = (event: MessageEvent<unknown>) => {
            if (event.origin !== server || event.source !== window.parent) {
                return;
            }
            const ready = parsePreviewReady(event.data);
            if (ready?.version === PREVIEW_PROTOCOL_VERSION) {
                usePreviewExtension.setState({ isReady: true });
            }
        };
        window.addEventListener("message", handleMessage);
        postToPreviewExtension(server, {
            source: PREVIEW_SOURCE,
            type: "hello"
        });
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, [server]);
}

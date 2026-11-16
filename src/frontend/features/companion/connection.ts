/** The FRCDesignApp Companion, in the Onshape page the panel is in, when it's installed. */
import {
    COMPANION_PROTOCOL_VERSION,
    COMPANION_SOURCE,
    type CompanionRequest,
    parseCompanionReady
} from "@backend/features/companion/contract";
import { Hint } from "@backend/features/hints/contract";
import { useEffect } from "react";
import { create } from "zustand";
import {
    useIsConnectedToOnshape,
    useOnshapeServer
} from "../../lib/onshape-params";
import { useMarkHintSeen } from "../hints/queries";

interface CompanionState {
    /** Whether it answered, in this protocol's version. */
    isConnected: boolean;
}

export const useCompanion = create<CompanionState>(() => ({
    isConnected: false
}));

/** Posted to the Onshape page; meshes are copied, so the query cache keeps its own. */
export function postToCompanion(server: string, request: CompanionRequest) {
    window.parent.postMessage(request, server);
}

/** It's a Chrome extension: Chrome and the browsers built on it, Edge and Opera, can install it. */
export function isCompanionBrowser(): boolean {
    return /\bChrome\//.test(navigator.userAgent);
}

/** Inside Onshape, in a browser that can install it. */
export function useCanUseCompanion(): boolean {
    return useIsConnectedToOnshape() && isCompanionBrowser();
}

/** Asks the Onshape page for the Companion once a launch names it; from the app shell. */
export function useCompanionHandshake() {
    const server = useOnshapeServer();
    const isConnected = useCompanion((state) => state.isConnected);
    const markConnected = useMarkHintSeen(Hint.CONNECTED_COMPANION);

    useEffect(() => {
        if (!server || window.parent === window) {
            return;
        }
        const handleMessage = (event: MessageEvent<unknown>) => {
            if (event.origin !== server || event.source !== window.parent) {
                return;
            }
            const ready = parseCompanionReady(event.data);
            if (ready?.version === COMPANION_PROTOCOL_VERSION) {
                useCompanion.setState({ isConnected: true });
            }
        };
        window.addEventListener("message", handleMessage);
        postToCompanion(server, { source: COMPANION_SOURCE, type: "hello" });
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, [server]);

    // Waits for access to be known, which marking needs
    useEffect(() => {
        if (isConnected) {
            markConnected();
        }
    }, [isConnected, markConnected]);
}

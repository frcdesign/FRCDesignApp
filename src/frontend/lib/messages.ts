/**
 * The Onshape Client Messaging API, for a right-panel extension (not a tab one).
 * https://onshape-public.github.io/docs/app-dev/clientmessaging/
 */

import { useSearch } from "@tanstack/react-router";
import { type ElementPath } from "@backend/lib/onshape/path";
import { useCallback, useEffect } from "react";
import { useIsConnectedToOnshape } from "./onshape-params";

export function useMessageListener() {
    const search = useSearch({ from: "/app" });
    // Nothing to message unless embedded in an Onshape document.
    const isConnected = useIsConnectedToOnshape();

    useEffect(() => {
        if (isConnected) {
            sendInitMessage(search);
        }
    }, [search, isConnected]);

    useEffect(() => {
        const handlePostMessage = (event: MessageEvent) => {
            if (search.server !== event.origin) {
                return;
            }
            const messageName = event.data.messageName;
            if (!messageName) {
                return;
            }
        };

        window.addEventListener("message", handlePostMessage);
        return () => {
            window.removeEventListener("message", handlePostMessage);
        };
    }, [search.server]);
}

export function useMessageSender() {
    const search = useSearch({ from: "/app" });
    const isConnected = useIsConnectedToOnshape();
    return useCallback(
        (message: Message) => {
            if (!isConnected) return;
            sendMessage(search, message);
        },
        [search, isConnected]
    );
}

function sendInitMessage(elementPath: ElementPath) {
    sendMessage(elementPath, { messageName: MessageType.APPLICATION_INIT });
}

export function sendOpenFeatureMessage(
    elementPath: ElementPath,
    featureId: string
) {
    sendMessage(elementPath, {
        messageName: MessageType.OPEN_FEATURE,
        featureId
    });
}

export enum MessageType {
    APPLICATION_INIT = "applicationInit",
    SHOW_MESSAGE_BUBBLE = "showMessageBubble",
    REQUEST_IMAGE = "requestViewerImage",
    REQUEST_SELECTION = "requestSelection",
    REQUEST_HIGHLIGHT_SELECTION = "requestSelectionHighlight",
    SWITCH_TAB = "openAnotherElementInCurrentWorkspace",
    OPEN_FEATURE = "openFeatureDialog",
    CLOSE_FEATURE = "closeFeatureDialog"
}

interface Message {
    messageName: MessageType;
    [key: string]: any;
}

function sendMessage(elementPath: ElementPath, message: Message) {
    const messageToSend = {
        ...message,
        documentId: elementPath.documentId,
        workspaceId: elementPath.instanceId,
        elementId: elementPath.elementId
    };
    window.parent.postMessage(messageToSend, "*");
}

/**
 * The Onshape Client Messaging API, for a right-panel extension (not a tab one).
 * https://onshape-public.github.io/docs/app-dev/clientmessaging/
 */

import { type ElementPath } from "@backend/lib/onshape/path";
import { useEffect } from "react";
import { useOnshapeServer, useTargetElement } from "./onshape-params";

export function useMessageListener() {
    // Nothing to message unless embedded in an Onshape document.
    const target = useTargetElement();
    const server = useOnshapeServer();

    useEffect(() => {
        if (target) {
            sendInitMessage(target);
        }
    }, [target]);

    useEffect(() => {
        const handlePostMessage = (event: MessageEvent) => {
            if (server !== event.origin) {
                return;
            }
            const { messageName } = event.data as Partial<Message>;
            if (!messageName) {
                return;
            }
        };

        window.addEventListener("message", handlePostMessage);
        return () => {
            window.removeEventListener("message", handlePostMessage);
        };
    }, [server]);
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

/** Onshape wants every request identified; only one of ours is ever up. */
const INSERT_LOCATION_HIGHLIGHT_ID = "highlight-insert-location";

/**
 * Lights the insert location marker up in the Onshape viewport until
 * {@link sendStopRequestMessage}. The marker is an inserted sketch, so what is
 * highlighted is its instance in this assembly rather than anything in the tab
 * it came from.
 */
export function sendHighlightInsertLocationMessage(
    elementPath: ElementPath,
    instanceId: string
) {
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_HIGHLIGHT_SELECTION,
        messageId: INSERT_LOCATION_HIGHLIGHT_ID,
        selections: [
            {
                selectionType: "BODY",
                bodyType: "MATE_CONNECTOR",
                selectionId: instanceId
            }
        ]
    });
}

/** Ends whatever request is pending, which is how a highlight is taken back. */
export function sendStopRequestMessage(elementPath: ElementPath) {
    sendMessage(elementPath, { messageName: MessageType.STOP_REQUEST });
}

enum MessageType {
    APPLICATION_INIT = "applicationInit",
    SHOW_MESSAGE_BUBBLE = "showMessageBubble",
    REQUEST_IMAGE = "requestViewerImage",
    REQUEST_SELECTION = "requestSelection",
    REQUEST_HIGHLIGHT_SELECTION = "requestSelectionHighlight",
    SWITCH_TAB = "openAnotherElementInCurrentWorkspace",
    OPEN_FEATURE = "openFeatureDialog",
    CLOSE_FEATURE = "closeFeatureDialog",
    STOP_REQUEST = "stopRequest"
}

interface Message {
    messageName: MessageType;
    /** Whatever that message carries; Onshape names the fields, not us. */
    [key: string]: MessageType | string | number | boolean | object | undefined;
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

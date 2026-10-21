/** Onshape's Client Messaging API: https://onshape-public.github.io/docs/app-dev/clientmessaging/ */

import { type ElementPath } from "@backend/lib/onshape/path";
import { useEffect } from "react";
import { useOnshapeServer, useTargetElement } from "./onshape-params";
import {
    type OnshapeSelection,
    setOnshapeSelections
} from "./onshape-selection";

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
            const data = event.data as Partial<ReceivedMessage>;
            if (!data.messageName) {
                return;
            }
            // Sent unprompted once the app has initialized, and in answer to a
            // selection request.
            if (Array.isArray(data.selections)) {
                setOnshapeSelections(data.selections);
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

/** A blue bubble at the top of the Onshape window. */
export function sendShowMessageBubbleMessage(
    elementPath: ElementPath,
    message: string
) {
    sendMessage(elementPath, {
        messageName: MessageType.SHOW_MESSAGE_BUBBLE,
        message
    });
}

/**
 * Limits what can be picked in the Onshape window to circular edges. Unbounded,
 * so it stays pending until {@link sendStopRequestMessage} ends it.
 */
export function sendRequestCircleSelectionMessage(
    elementPath: ElementPath,
    messageId: string
) {
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_SELECTION,
        messageId,
        entityTypeSpecifier: ["EDGE"],
        selectionTypeSpecifier: ["GEOMETRY"],
        geometryTypeSpecifier: ["CIRCLE"]
    });
}

/** Ends the pending request, e.g. the one {@link sendRequestCircleSelectionMessage} opened. */
export function sendStopRequestMessage(elementPath: ElementPath) {
    sendMessage(elementPath, { messageName: MessageType.STOP_REQUEST });
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

/*
 * Highlighting the insert location was tried and dropped:
 * `requestSelectionHighlight` answered SUCCESS and painted nothing. Undocumented
 * findings from that:
 *
 * - A `requestSelection` filter takes one specifier per level. A mate connector
 *   is `selectionTypeSpecifier: ["BODY"]` with `bodyTypeSpecifier: ["MATE_CONNECTOR"]`.
 * - A highlight cancels any outstanding selection request.
 * - Don't send back the `OCCURRENCE` selection Onshape reports for an assembly
 *   instance; the instance list breaks.
 */

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

/** What Onshape posts to the app; only the fields we read. */
interface ReceivedMessage {
    messageName: string;
    selections?: OnshapeSelection[];
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

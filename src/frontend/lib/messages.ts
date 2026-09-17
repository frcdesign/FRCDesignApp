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

/*
 * Selecting and highlighting are not here. Lighting the insert location up in
 * the viewport was tried and set aside: `requestSelectionHighlight` answered
 * every payload we sent it `statusCode: "SUCCESS"` and painted nothing, and we
 * never established whether it paints anything at all in an assembly. What was
 * learned along the way, none of which Onshape documents:
 *
 * - A `requestSelection` filter is one specifier per level, not the single
 *   `entityTypeSpecifier` the docs describe. A mate connector is
 *   `selectionTypeSpecifier: ["BODY"]` with
 *   `bodyTypeSpecifier: ["MATE_CONNECTOR"]`, and `geometryTypeSpecifier` sits
 *   under a `GEOMETRY` one.
 * - A highlight cancels whatever selection request is outstanding rather than
 *   sitting alongside it.
 * - An inbound SELECTION reports an assembly instance as a `selectionType` of
 *   `OCCURRENCE`, carrying an `occurrencePath`. Do not send that back: Onshape
 *   takes it and the instance list falls over.
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

function sendMessage(elementPath: ElementPath, message: Message) {
    const messageToSend = {
        ...message,
        documentId: elementPath.documentId,
        workspaceId: elementPath.instanceId,
        elementId: elementPath.elementId
    };
    window.parent.postMessage(messageToSend, "*");
}

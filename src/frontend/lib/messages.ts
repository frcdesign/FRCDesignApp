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
    const server = search.server; // The server parameter received from Onshape, usually "cad"
    const elementPath: ElementPath = search;

    useEffect(() => {
        if (isConnected) {
            sendInitMessage(elementPath);

            // sendShowMessageBubbleMessage(
            //     elementPath,
            //     "Select a circular edge!"
            // );
            // sendSelectEdgeMessage(elementPath);
        }
    }, [elementPath, isConnected]);

    const handlePostMessage = useCallback(
        (event: MessageEvent) => {
            if (server !== event.origin) {
                return;
            }
            const messageName = event.data.messageName;
            if (!messageName) {
                return;
            }
            console.log(event.data);
        },
        [server]
    );

    useEffect(() => {
        window.addEventListener("message", handlePostMessage);
        return () => {
            window.removeEventListener("message", handlePostMessage);
        };
    }, [handlePostMessage]);
}

function sendInitMessage(elementPath: ElementPath) {
    sendMessage(elementPath, { messageName: MessageType.APPLICATION_INIT });
}

/** One entity the user has selected, as Onshape reports it back. */
export interface OnshapeSelection {
    selectionType: string;
    selectionId: string;
    entityType?: string;
    /** The instance the entity belongs to; empty outside an assembly. */
    occurrencePath?: string[];
    workspaceMicroversionId?: string;
}

/**
 * Puts Onshape into circular-edge selection mode. No selection count, so it
 * stays pending until {@link sendStopRequestMessage} ends it. An example
 * selection is:
 * {entityType: "EDGE", occurrencePath: ["<occurrence id>"], selectionId: "JH1", "selectionType": "ENTITY", "workspaceMicroversionId": "<microversion id>"}
 */
export function sendSelectEdgeMessage(
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

/** Ends a pending request, e.g. the one `sendSelectEdgeMessage` opened. */
export function sendStopRequestMessage(elementPath: ElementPath) {
    sendMessage(elementPath, { messageName: MessageType.STOP_REQUEST });
}

/**
 * The selections a message from Onshape carries, or undefined for one that
 * isn't about selection. Onshape sends these unprompted once the app has
 * initialized, as well as in answer to a selection request.
 */
export function getSelections(data: any): OnshapeSelection[] | undefined {
    const selections = data?.selections;
    return Array.isArray(selections) ? selections : undefined;
}

export function sendShowMessageBubbleMessage(
    elementPath: ElementPath,
    message: string
) {
    return sendMessage(elementPath, {
        messageName: MessageType.SHOW_MESSAGE_BUBBLE,
        message
    });
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
    /** Sent by Onshape, not us: what the user has selected. */
    SELECTION = "SELECTION",
    STOP_REQUEST = "stopRequest",
    SHOW_MESSAGE_BUBBLE = "showMessageBubble",
    REQUEST_IMAGE = "requestViewerImage",
    REQUEST_SELECTION = "requestSelection",
    REQUEST_HIGHLIGHT_SELECTION = "requestSelectionHighlight",
    SWITCH_TAB = "openAnotherElementInCurrentWorkspace",
    OPEN_FEATURE = "openFeatureDialog",
    CLOSE_FEATURE = "closeFeatureDialog"
}

// export function useMessageSender() {
//     const search = useSearch({ from: "/app" });
//     const isConnected = useIsConnectedToOnshape();
//     return useCallback(
//         (message: Message) => {
//             if (!isConnected) return;
//             sendMessage(search, message);
//         },
//         [search, isConnected]
//     );
// }

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

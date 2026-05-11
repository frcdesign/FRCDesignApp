/**
 * Code for working with the Onshape Client Messaging API.
 *
 * See also:
 * https://onshape-public.github.io/docs/app-dev/clientmessaging/
 *
 * (Note we are an Element right panel extension and not an Element tab extension).
 */

import { useSearch } from "@tanstack/react-router";
import { ElementPath } from "../onshape-api/path";
import { useCallback } from "react";

export function useMessageListener() {
    const search = useSearch({ from: "/app" });
    const handlePostMessage = (event: MessageEvent) => {
        console.log("received message from: " + search.server);
        if (search.server !== event.origin) {
            return;
        }
        const messageName = event.data.messageName;
        console.log("message name: " + messageName);
        if (!messageName) {
            return;
        }
        console.log(event.data);
    };

    window.addEventListener("message", handlePostMessage);

    sendInitMessage(search);

    // sendMessage(search, {
    //     messageName: MessageType.SWITCH_TAB,
    //     anotherElementId: "6f1b9432e53b84c105518d80"
    // });

    // sendMessage(search, {
    //     messageName: MessageType.REQUEST_SELECTION,
    //     messageId: "unique-message-id",
    //     entityTypeSpecifier: ["EDGE"]
    // });

    return () => {
        window.removeEventListener("message", handlePostMessage);
    };
}

export function useMessageSender() {
    const search = useSearch({ from: "/app" });
    return useCallback(
        (message: Message) => {
            sendMessage(search, message);
        },
        [search]
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

/** Onshape's Client Messaging API: https://onshape-public.github.io/docs/app-dev/clientmessaging/ */

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
            if (import.meta.env.DEV) {
                // Onshape documents no answer to most messages; this is how to see them.
                console.debug("Received from Onshape", event.data);
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

let highlights = 0;

/**
 * Selects a part in the Onshape window. In an assembly, `occurrencePath` says
 * which instance, and Onshape still needs the part's id to select anything in it.
 */
export function sendSelectPartMessage(
    elementPath: ElementPath,
    partId: string,
    occurrencePath?: string[]
) {
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_HIGHLIGHT_SELECTION,
        messageId: `highlight-${++highlights}`,
        selections: [
            {
                selectionType: "ENTITY",
                entityType: "BODY",
                selectionId: partId,
                ...(occurrencePath && { occurrencePath })
            }
        ]
    });
}

/*
 * The insert location isn't highlighted: for its mate connector,
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

function sendMessage(elementPath: ElementPath, message: Message) {
    const messageToSend = {
        ...message,
        documentId: elementPath.documentId,
        workspaceId: elementPath.instanceId,
        elementId: elementPath.elementId
    };
    window.parent.postMessage(messageToSend, "*");
}

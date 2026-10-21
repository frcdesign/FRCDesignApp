/** Onshape's Client Messaging API: https://onshape-public.github.io/docs/app-dev/clientmessaging/ */

import { type ElementPath } from "@backend/lib/onshape/path";
import { useEffect } from "react";
import { useOnshapeServer, useTargetElement } from "./onshape-params";
import { parseSelections, useOnshapeSelection } from "./selection";

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
            const { messageName } = event.data as { messageName?: string };
            if (messageName === INBOUND_SELECTION) {
                useOnshapeSelection
                    .getState()
                    .receive(parseSelections(event.data));
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

/** What Onshape sends whenever the selection in its window changes, once the app has said it's ready. */
const INBOUND_SELECTION = "SELECTION";

/** Onshape wants every request identified; one highlight is up at a time. */
const HIGHLIGHT_ID = "highlight-selection";

/** Something picked in the assembly, as Onshape names it. */
export interface HighlightedEntity {
    entityType: string;
    selectionId: string;
    occurrencePath: string[];
}

/**
 * Lights entities up in the Onshape window until {@link sendStopRequestMessage}.
 * Untried in an assembly with entities: a mate connector's body never lit
 * (see below), and this is the documented shape for an entity.
 */
export function sendHighlightMessage(
    elementPath: ElementPath,
    entities: HighlightedEntity[]
) {
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_HIGHLIGHT_SELECTION,
        messageId: HIGHLIGHT_ID,
        selections: entities.map((entity) => ({
            selectionType: "ENTITY",
            entityType: entity.entityType,
            selectionId: entity.selectionId,
            occurrencePath: entity.occurrencePath
        }))
    });
}

/** Ends whatever request is pending, which is how a highlight is taken back. */
export function sendStopRequestMessage(elementPath: ElementPath) {
    sendMessage(elementPath, { messageName: MessageType.STOP_REQUEST });
}

/** Onshape's blue bubble at the top of the panel. */
export function sendMessageBubble(elementPath: ElementPath, message: string) {
    sendMessage(elementPath, {
        messageName: MessageType.SHOW_MESSAGE_BUBBLE,
        message
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

function sendMessage(elementPath: ElementPath, message: Message) {
    const messageToSend = {
        ...message,
        documentId: elementPath.documentId,
        workspaceId: elementPath.instanceId,
        elementId: elementPath.elementId
    };
    window.parent.postMessage(messageToSend, "*");
}

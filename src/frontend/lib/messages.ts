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
            } else if (isHighlightAnswer(event.data)) {
                // Whether Onshape took a highlight is otherwise invisible; see `sendHighlightMessage`
                console.debug("Onshape answered a highlight", event.data);
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

/** Onshape wants each request identified uniquely; one highlight is up at a time. */
const HIGHLIGHT_PREFIX = "highlight-selection-";
let highlights = 0;

function isHighlightAnswer(data: unknown): boolean {
    const { messageId, stoppedMessageId } = data as {
        messageId?: unknown;
        stoppedMessageId?: unknown;
    };
    return [messageId, stoppedMessageId].some(
        (id) => typeof id === "string" && id.startsWith(HIGHLIGHT_PREFIX)
    );
}

/** Something picked in the assembly, as Onshape names it. */
export interface HighlightedEntity {
    entityType: string;
    selectionId: string;
    occurrencePath: string[];
}

/**
 * Lights entities up in the Onshape window until {@link sendStopRequestMessage}.
 * Unconfirmed in an assembly: Onshape documents this shape for a Part Studio
 * entity, without `occurrencePath`, and a mate connector's body never lit (see
 * below). Its answers are logged at debug level.
 */
export function sendHighlightMessage(
    elementPath: ElementPath,
    entities: HighlightedEntity[]
) {
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_HIGHLIGHT_SELECTION,
        messageId: `${HIGHLIGHT_PREFIX}${++highlights}`,
        selections: entities.map((entity) => ({
            selectionType: "ENTITY",
            entityType: entity.entityType,
            selectionId: entity.selectionId,
            occurrencePath: entity.occurrencePath
        }))
    });
}

/** Lights nothing, taking back what {@link sendHighlightMessage} lit. */
export function clearHighlight(elementPath: ElementPath) {
    sendHighlightMessage(elementPath, []);
}

/**
 * What the Onshape window lets be picked while a request is pending, as
 * `requestSelection` takes it: an array of one specifier at each level. Onshape
 * documents other field names, which it ignores.
 */
export interface SelectionFilter {
    entityTypeSpecifier: string[];
    selectionTypeSpecifier: string[];
    geometryTypeSpecifier?: string[];
}

export const CIRCULAR_EDGES: SelectionFilter = {
    entityTypeSpecifier: ["EDGE"],
    selectionTypeSpecifier: ["GEOMETRY"],
    geometryTypeSpecifier: ["CIRCLE"]
};

export const FACES: SelectionFilter = {
    entityTypeSpecifier: ["FACE"],
    selectionTypeSpecifier: ["GEOMETRY"]
};

let selectionRequests = 0;

/**
 * Limits picks in the Onshape window to `filter` until {@link sendStopRequestMessage}.
 * Picks still arrive as SELECTION messages; the request only limits what the
 * window lets be picked.
 */
export function sendSelectionRequest(
    elementPath: ElementPath,
    filter: SelectionFilter
) {
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_SELECTION,
        messageId: `selection-${++selectionRequests}`,
        ...filter
    });
}

/** Ends whatever request is pending: a selection filter, or a highlight. */
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

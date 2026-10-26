/** Onshape's Client Messaging API: https://onshape-public.github.io/docs/app-dev/clientmessaging/ */

import { type ElementPath } from "@backend/lib/onshape/path";
import { useEffect } from "react";
import { useOnshapeServer, useTargetElement } from "./onshape-params";
import {
    expectCleared,
    expectSelection,
    parseSelections,
    useOnshapeSelection
} from "./selection";

/**
 * What carries the window's whole selection each time it changes: SELECTION,
 * and while a request is pending, its answers instead, when they have one.
 */
const SELECTION_MESSAGES = new Set([
    "SELECTION",
    "REQUESTED_SELECTION",
    "REQUESTED_SELECTION_HIGHLIGHT"
]);

function carriesSelection(data: unknown): boolean {
    const { messageName, selections } = data as {
        messageName?: unknown;
        selections?: unknown;
    };
    return (
        typeof messageName === "string" &&
        SELECTION_MESSAGES.has(messageName) &&
        Array.isArray(selections)
    );
}

declare global {
    interface Window {
        /** Posts a message to Onshape, addressed to the launching element; from the browser console. */
        sendToOnshape?: (message: Record<string, unknown>) => void;
    }
}

export function useMessageListener() {
    // Nothing to message unless embedded in an Onshape document.
    const target = useTargetElement();
    const server = useOnshapeServer();

    useEffect(() => {
        if (!target) {
            return;
        }
        sendInitMessage(target);
        // For trying messages Onshape doesn't document, from the browser console
        window.sendToOnshape = (message) =>
            sendMessage(target, message as unknown as Message);
        return () => {
            delete window.sendToOnshape;
        };
    }, [target]);

    useEffect(() => {
        const handlePostMessage = (event: MessageEvent) => {
            if (server !== event.origin) {
                return;
            }
            // What Onshape sends about selection is undocumented; this is how to see it
            console.debug("Received from Onshape", event.data);
            if (carriesSelection(event.data)) {
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

/** Onshape wants each request identified uniquely; one highlight is up at a time. */
const HIGHLIGHT_PREFIX = "highlight-selection-";
let highlights = 0;

/** Something picked in the assembly, as Onshape names it. */
export interface HighlightedEntity {
    entityType: string;
    selectionId: string;
    occurrencePath: string[];
}

/**
 * Makes `entities` what the Onshape window shows selected, in place of what it
 * showed. Onshape documents this shape for a Part Studio entity, without
 * `occurrencePath`; a mate connector's body never lit (see below). It carries
 * `filter` as single values, in the fields Onshape documents for each of its
 * `selections`; whether a highlight keeps picks limited by them is untried.
 */
export function sendHighlightMessage(
    elementPath: ElementPath,
    entities: HighlightedEntity[],
    filter?: SelectionFilter
) {
    expectSelection(entities);
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_HIGHLIGHT_SELECTION,
        messageId: `${HIGHLIGHT_PREFIX}${++highlights}`,
        ...(filter && {
            selectionType: filter.selectionTypeSpecifier[0],
            entityType: filter.entityTypeSpecifier[0],
            geometryType: filter.geometryTypeSpecifier?.[0]
        }),
        selections: entities.map((entity) => ({
            selectionType: "ENTITY",
            entityType: entity.entityType,
            selectionId: entity.selectionId,
            occurrencePath: entity.occurrencePath
        }))
    });
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

export const PLANAR_FACES: SelectionFilter = {
    entityTypeSpecifier: ["FACE"],
    selectionTypeSpecifier: ["GEOMETRY"],
    geometryTypeSpecifier: ["PLANE"]
};

const SELECTION_PREFIX = "selection-";
let selectionRequests = 0;

/**
 * Limits picks in the Onshape window to `filter` until {@link sendStopRequestMessage},
 * clearing what it shows selected. Picks still arrive as SELECTION messages.
 */
export function sendSelectionRequest(
    elementPath: ElementPath,
    filter: SelectionFilter
) {
    expectCleared();
    sendMessage(elementPath, {
        messageName: MessageType.REQUEST_SELECTION,
        messageId: `${SELECTION_PREFIX}${++selectionRequests}`,
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
    console.debug("Sent to Onshape", messageToSend);
    window.parent.postMessage(messageToSend, "*");
}

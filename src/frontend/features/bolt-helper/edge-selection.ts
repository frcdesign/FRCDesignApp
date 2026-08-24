import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { type ElementPath } from "@backend/lib/onshape/path";
import { type EdgeSelection } from "@backend/features/bolt-helper/contract";
import {
    getSelections,
    sendSelectEdgeMessage,
    sendShowMessageBubbleMessage,
    sendStopRequestMessage,
    type OnshapeSelection
} from "../../lib/messages";
import { useIsConnectedToOnshape } from "../../lib/onshape-params";

/** Names the pending request, so Onshape's stop answer can be tied to it. */
const SELECTION_REQUEST_ID = "bolt-helper-edges";

export interface EdgeSelectionState {
    edges: EdgeSelection[];
    clear: () => void;
}

/**
 * Holds Onshape in circular-edge selection mode for as long as the caller is
 * mounted, and reports what is selected.
 */
export function useCircularEdgeSelection(): EdgeSelectionState {
    const search = useSearch({ from: "/app" });
    const isConnected = useIsConnectedToOnshape();
    const [edges, setEdges] = useState<EdgeSelection[]>([]);

    const elementPath: ElementPath = search;
    const server = search.server;

    useEffect(() => {
        if (!isConnected) {
            return;
        }
        // Unbounded, so the request stays open until this stops it; leaving it
        // pending would keep Onshape in selection mode after the tab closes.
        sendShowMessageBubbleMessage(
            elementPath,
            "Select circular edges to use."
        );
        sendSelectEdgeMessage(elementPath, SELECTION_REQUEST_ID);
        return () => sendStopRequestMessage(elementPath);
    }, [elementPath, isConnected]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (server !== event.origin) {
                return;
            }
            const selections = getSelections(event.data);
            if (!selections) {
                return;
            }
            // Each message carries the whole selection, so replacing is what
            // follows a deselect.
            setEdges(selections.filter(isEdge).map(toEdgeSelection));
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [server]);

    const clear = useCallback(() => setEdges([]), []);
    return { edges, clear };
}

/** Onshape reports whatever the user clicks, which need not be an edge. */
function isEdge(selection: OnshapeSelection): boolean {
    return (
        selection.entityType === undefined || selection.entityType === "EDGE"
    );
}

function toEdgeSelection(selection: OnshapeSelection): EdgeSelection {
    return {
        selectionId: selection.selectionId,
        occurrencePath: selection.occurrencePath ?? []
    };
}

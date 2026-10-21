/** The circles an insert and fasten mates to, picked in the Onshape window. */
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { type CircleSelection } from "@backend/features/library/contract";
import {
    type OnshapeSelection,
    setOnshapeSelections,
    useOnshapeSelection
} from "../../lib/onshape-selection";
import {
    sendRequestCircleSelectionMessage,
    sendShowMessageBubbleMessage,
    sendStopRequestMessage
} from "../../lib/messages";
import { useTargetElement } from "../../lib/onshape-params";

const SELECTION_REQUEST_ID = "fasten-circles";

/** Marks the field a click can land in without ending the selection. */
export const CIRCLE_FIELD_ATTRIBUTE = "data-circle-field";

/**
 * Onshape reports whatever was clicked, and an unprompted report doesn't say
 * an edge's geometry, so any edge counts until the mate tries it.
 */
function isEdge(selection: OnshapeSelection): boolean {
    return (
        selection.entityType === undefined || selection.entityType === "EDGE"
    );
}

function toCircles(selections: OnshapeSelection[]): CircleSelection[] {
    return selections.filter(isEdge).map((selection) => ({
        selectionId: selection.selectionId,
        occurrencePath: selection.occurrencePath ?? []
    }));
}

export function useSelectedCircles(): CircleSelection[] {
    const selections = useOnshapeSelection((state) => state.selections);
    return useMemo(() => toCircles(selections), [selections]);
}

export function getSelectedCircles(): CircleSelection[] {
    return toCircles(useOnshapeSelection.getState().selections);
}

/**
 * Once fastened to, so the next insert doesn't land on the same circles. If
 * Onshape still has them selected, its next selection message brings them back.
 */
export function clearSelectedCircles(): void {
    setOnshapeSelections([]);
}

const useCircleSelectionMode = create(() => ({ isSelecting: false }));

/** Whether the field is active, holding Onshape to picking circles. */
export function useIsSelectingCircles(): boolean {
    return useCircleSelectionMode((state) => state.isSelecting);
}

export function setSelectingCircles(isSelecting: boolean): void {
    useCircleSelectionMode.setState({ isSelecting });
}

/**
 * Holds Onshape to picking circles while the field is active. The field sits in
 * a hover card that closes as the pointer leaves for Onshape, so the request
 * lives here, ending on a click elsewhere in the app or when the caller unmounts.
 */
export function useCircleSelectionRequest(): void {
    const target = useTargetElement();
    const isSelecting = useIsSelectingCircles();

    useEffect(() => {
        if (!target || !isSelecting) {
            return;
        }
        sendShowMessageBubbleMessage(target, "Select circles to use.");
        sendRequestCircleSelectionMessage(target, SELECTION_REQUEST_ID);

        const endOnClickElsewhere = (event: PointerEvent) => {
            const clicked = event.target;
            if (
                !(
                    clicked instanceof Element &&
                    clicked.closest(`[${CIRCLE_FIELD_ATTRIBUTE}]`)
                )
            ) {
                setSelectingCircles(false);
            }
        };
        document.addEventListener("pointerdown", endOnClickElsewhere);
        return () => {
            document.removeEventListener("pointerdown", endOnClickElsewhere);
            sendStopRequestMessage(target);
        };
    }, [target, isSelecting]);

    useEffect(() => () => setSelectingCircles(false), []);
}

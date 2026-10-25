/** What an insert and fasten mates to: circular edges, or faces less holes to skip, picked in the Onshape window. */
import { useEffect } from "react";
import { create } from "zustand";
import {
    CIRCULAR_EDGES,
    FACES,
    type SelectionFilter
} from "../../lib/messages";
import { SelectionMode } from "@backend/features/quick-fastener/contract";
import {
    isEdge,
    isFace,
    type OnshapeSelection,
    useOnshapeSelection
} from "../../lib/selection";

export const FASTEN_TARGETS_LIST = "insert-fasten-targets";
export const FASTEN_EXCLUDED_LIST = "insert-fasten-excluded";

interface FastenPicksState {
    targets: OnshapeSelection[];
    /** Edges of holes in the faces to leave out; faces only. */
    excluded: OnshapeSelection[];
}

/** Held for the tab: picks belong to the assembly open now. */
export const useFastenPicks = create<FastenPicksState>(() => ({
    targets: [],
    excluded: []
}));

export function setFastenTargets(targets: OnshapeSelection[]): void {
    useFastenPicks.setState({ targets });
}

export function setFastenExcluded(excluded: OnshapeSelection[]): void {
    useFastenPicks.setState({ excluded });
}

/** Once fastened to, so the next insert doesn't land on the same edges. */
export function clearFastenPicks(): void {
    useFastenPicks.setState({ targets: [], excluded: [] });
}

export function targetFilter(mode: SelectionMode): SelectionFilter {
    return mode === SelectionMode.FACES ? FACES : CIRCULAR_EDGES;
}

export function acceptsTarget(
    mode: SelectionMode
): (selection: OnshapeSelection) => boolean {
    return mode === SelectionMode.FACES ? isFace : isEdge;
}

/**
 * Keeps the targets list taking picks while the menu is open. A change of
 * mode starts over, since picks of one kind mean nothing as the other.
 */
export function useFastenPicksFromSelection(mode: SelectionMode): void {
    useEffect(() => {
        if (!useFastenPicks.getState().targets.every(acceptsTarget(mode))) {
            clearFastenPicks();
        }
        useOnshapeSelection.getState().focus(FASTEN_TARGETS_LIST);
        return () => {
            if (isFastenList(useOnshapeSelection.getState().focused)) {
                useOnshapeSelection.getState().focus(undefined);
            }
        };
    }, [mode]);
}

export function isFastenList(listId: string | undefined): boolean {
    return listId === FASTEN_TARGETS_LIST || listId === FASTEN_EXCLUDED_LIST;
}

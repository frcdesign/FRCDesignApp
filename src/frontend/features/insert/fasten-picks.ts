/** What an insert and fasten mates to: circular edges, or faces less holes to skip, picked in the Onshape window. */
import { useEffect } from "react";
import { create } from "zustand";
import {
    CIRCULAR_EDGES,
    PLANAR_FACES,
    type SelectionFilter
} from "../../lib/messages";
import { SelectionMode } from "@backend/features/auto-assembly/contract";
import { isEdge, isFace, type OnshapeSelection } from "../../lib/selection";

export const FASTEN_TARGETS_LIST = "insert-fasten-targets";
export const FASTEN_EXCLUDED_LIST = "insert-fasten-excluded";

interface FastenPicksState {
    targets: OnshapeSelection[];
    /** Edges of holes in the faces to leave out; faces only. */
    excluded: OnshapeSelection[];
}

/** Held for the tab: picks belong to the assembly open now, and carry from the navbar into the insert menu. */
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
    return mode === SelectionMode.FACES ? PLANAR_FACES : CIRCULAR_EDGES;
}

export function acceptsTarget(
    mode: SelectionMode
): (selection: OnshapeSelection) => boolean {
    return mode === SelectionMode.FACES ? isFace : isEdge;
}

/** A change of mode starts over, since picks of one kind mean nothing as the other. */
export function useFastenPicksForMode(mode: SelectionMode): void {
    useEffect(() => {
        if (!useFastenPicks.getState().targets.every(acceptsTarget(mode))) {
            clearFastenPicks();
        }
    }, [mode]);
}

export function isFastenList(listId: string | undefined): boolean {
    return listId === FASTEN_TARGETS_LIST || listId === FASTEN_EXCLUDED_LIST;
}

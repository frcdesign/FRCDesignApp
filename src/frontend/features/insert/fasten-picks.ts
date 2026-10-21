/** What an insert and fasten mates to: circular edges, or faces less holes to skip, picked in the Onshape window. */
import { useEffect } from "react";
import { create } from "zustand";
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

export function acceptsTarget(
    mode: SelectionMode
): (selection: OnshapeSelection) => boolean {
    return mode === SelectionMode.FACES ? isFace : isEdge;
}

/**
 * Picks up what was selected before the menu opened, and keeps the targets
 * list taking picks while it is open. A change of mode starts over, since
 * picks of one kind mean nothing as the other.
 */
export function useFastenPicksFromSelection(mode: SelectionMode): void {
    useEffect(() => {
        const accepts = acceptsTarget(mode);
        const { targets } = useFastenPicks.getState();
        if (!targets.every(accepts)) {
            clearFastenPicks();
        }
        if (useFastenPicks.getState().targets.length === 0) {
            setFastenTargets(
                useOnshapeSelection.getState().current.filter(accepts)
            );
        }
        const selection = useOnshapeSelection.getState();
        selection.focus(FASTEN_TARGETS_LIST);
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

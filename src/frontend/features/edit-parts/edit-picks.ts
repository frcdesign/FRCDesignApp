/** The library parts picked in the Onshape window to edit. */
import { create } from "zustand";
import { type OnshapeSelection } from "../../lib/selection";

export const EDIT_PARTS_LIST = "edit-parts";

interface EditPicksState {
    parts: OnshapeSelection[];
}

/** Held for the tab: picks belong to the assembly open now. */
export const useEditPicks = create<EditPicksState>(() => ({ parts: [] }));

/** One part at most: a new pick takes the old one's place. */
export function setEditParts(parts: OnshapeSelection[]): void {
    useEditPicks.setState({ parts: parts.slice(-1) });
}

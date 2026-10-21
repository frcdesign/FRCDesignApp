/** What is selected in the Onshape window, as its latest selection message said. */
import { create } from "zustand";

/** One entity the user has selected, as Onshape reports it. */
export interface OnshapeSelection {
    selectionType: string;
    selectionId: string;
    entityType?: string;
    /** The instance the entity belongs to; empty outside an assembly. */
    occurrencePath?: string[];
}

interface OnshapeSelectionState {
    selections: OnshapeSelection[];
}

export const useOnshapeSelection = create<OnshapeSelectionState>(() => ({
    selections: []
}));

/** Each message carries the whole selection, so a deselect is a replace too. */
export function setOnshapeSelections(selections: OnshapeSelection[]): void {
    useOnshapeSelection.setState({ selections });
}

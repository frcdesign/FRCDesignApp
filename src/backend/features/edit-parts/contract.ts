/** Editing copies of a library part already in an assembly. A leaf, so the frontend can import it. */
import { type ElementPath } from "../../lib/onshape/path";
import {
    type PickProblem,
    type SelectedEntity
} from "../auto-assembly/contract";
import {
    type PartialSelection,
    type Selection
} from "../configurations/contract";

export interface EditCheckIn {
    assembly: ElementPath;
    /** Whole parts, as picked. */
    parts: SelectedEntity[];
    /** What the edit sets, so a copy that can't take it is marked. */
    changes?: PartialSelection;
}

export interface EditCheckOut {
    /** The part the first pick is a copy of; absent when it's no library part. */
    insertableId?: string;
    /** The first pick's configuration as it is now. */
    selection?: Selection;
    /** Copies the picks name. */
    pickedCount: number;
    /** Copies whose configuration matches a pick's, the picks included. */
    matchingCount: number;
    problems: PickProblem[];
}

export interface EditPartsIn extends Required<EditCheckIn> {
    /** Also every copy whose configuration matches a pick's. */
    applyToAll: boolean;
}

export interface EditPartsOut {
    updated: number;
}

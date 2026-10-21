/**
 * What's selected in the Onshape window, from its SELECTION messages, and the
 * one query list taking picks from it. Onshape sends the whole selection each
 * time it changes; a focused list takes what's newly in it.
 */
import { create } from "zustand";

/** An edge, face or other entity picked in an assembly. */
export interface OnshapeSelection {
    entityType: string;
    /** Its deterministic id in the Part Studio it's from. */
    selectionId: string;
    /** The part occurrence it's on, from the assembly down. */
    occurrencePath: string[];
}

export function selectionKey(selection: OnshapeSelection): string {
    return `${selection.occurrencePath.join("/")}|${selection.selectionId}`;
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((each) => typeof each === "string")
    );
}

/**
 * The entities in a SELECTION message, which Onshape doesn't document: each
 * of its `selections` names a `selectionType`, and an entity also its
 * `entityType`, `selectionId` and `occurrencePath`. An `OCCURRENCE` (a whole
 * instance) and anything else is left out.
 */
export function parseSelections(data: unknown): OnshapeSelection[] {
    const selections = (data as { selections?: unknown }).selections;
    if (!Array.isArray(selections)) {
        return [];
    }
    return selections.flatMap((each: unknown) => {
        const entry = each as Record<string, unknown>;
        if (
            entry.selectionType !== "ENTITY" ||
            typeof entry.entityType !== "string" ||
            typeof entry.selectionId !== "string" ||
            !isStringArray(entry.occurrencePath) ||
            entry.occurrencePath.length === 0
        ) {
            return [];
        }
        return [
            {
                entityType: entry.entityType,
                selectionId: entry.selectionId,
                occurrencePath: entry.occurrencePath
            }
        ];
    });
}

type PickHandler = (picked: OnshapeSelection[]) => void;

interface SelectionState {
    current: OnshapeSelection[];
    /** The query list taking picks; none takes them when absent. */
    focused?: string;
    receive: (selections: OnshapeSelection[]) => void;
    focus: (listId: string | undefined) => void;
}

/** Each mounted query list's handler, by its id; not state, since nothing renders from it. */
const handlers = new Map<string, PickHandler>();

export function onPick(listId: string, handler: PickHandler): () => void {
    handlers.set(listId, handler);
    return () => {
        handlers.delete(listId);
    };
}

export const useOnshapeSelection = create<SelectionState>()((set, get) => ({
    current: [],
    receive: (selections) => {
        const { current, focused } = get();
        const before = new Set(current.map(selectionKey));
        const picked = selections.filter(
            (selection) => !before.has(selectionKey(selection))
        );
        set({ current: selections });
        if (focused && picked.length > 0) {
            handlers.get(focused)?.(picked);
        }
    },
    focus: (listId) => set({ focused: listId })
}));

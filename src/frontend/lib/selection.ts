/**
 * Picks in the Onshape window, from its SELECTION messages, and the one query
 * list taking them. Once the app sends `applicationInit`, Onshape sends the
 * whole selection each time it changes; a focused list takes what was added
 * and drops what was deselected.
 */
import { create } from "zustand";
import {
    type SelectedEntity,
    SelectedEntityType
} from "@backend/features/quick-fastener/contract";

/** An edge, face or other entity picked in an assembly. */
export interface OnshapeSelection {
    entityType: string;
    /** Its deterministic id in the Part Studio it's from. */
    selectionId: string;
    /** The part occurrence it's on, from the assembly down. */
    occurrencePath: string[];
}

export const isEdge = (selection: OnshapeSelection): boolean =>
    selection.entityType === SelectedEntityType.EDGE;

export const isFace = (selection: OnshapeSelection): boolean =>
    selection.entityType === SelectedEntityType.FACE;

/** As a request carries picks. */
export function toSelectedEntities(
    selections: OnshapeSelection[]
): SelectedEntity[] {
    return selections.map((selection) => ({
        occurrencePath: selection.occurrencePath,
        entityId: selection.selectionId,
        entityType: selection.entityType as SelectedEntityType
    }));
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

/** How the Onshape window's selection changed since its last SELECTION message. */
export interface SelectionChange {
    added: OnshapeSelection[];
    removed: OnshapeSelection[];
}

type PickHandler = (change: SelectionChange) => void;

interface SelectionState {
    /** The query list taking picks; none takes them when absent. */
    focused?: string;
    /** What the Onshape window last said it has selected. */
    shown: OnshapeSelection[];
    /**
     * A selection the app asked Onshape to show, whose SELECTION messages
     * aren't picks. Onshape answers a highlight with an empty selection, then
     * the one highlighted, and may interleave an earlier highlight's; `until`
     * keeps a selection that never arrives from holding picks back.
     */
    awaited?: { keys: string; until: number };
    /** Takes a SELECTION message's whole selection. */
    receive: (selection: OnshapeSelection[]) => void;
    focus: (listId: string | undefined) => void;
}

/** Long enough for Onshape to answer, short of anyone picking in its window after clicking the panel. */
const AWAIT_MS = 1000;

function keysOf(selection: OnshapeSelection[]): string {
    return selection.map(selectionKey).sort().join(",");
}

/** Says the app made the Onshape window show `selection`, rather than someone picking it. */
export function expectSelection(selection: OnshapeSelection[]): void {
    useOnshapeSelection.setState({
        awaited: { keys: keysOf(selection), until: Date.now() + AWAIT_MS }
    });
}

/** A selection request clears the window's selection, which says so only if there was one. */
export function expectCleared(): void {
    if (useOnshapeSelection.getState().shown.length > 0) {
        expectSelection([]);
    }
}

/** `selections` less any in `removed`. */
export function without(
    selections: OnshapeSelection[],
    removed: OnshapeSelection[]
): OnshapeSelection[] {
    const keys = new Set(removed.map(selectionKey));
    return selections.filter((each) => !keys.has(selectionKey(each)));
}

/** Each mounted query list's handler, by its id; not state, since nothing renders from it. */
const handlers = new Map<string, PickHandler>();

export function onPick(listId: string, handler: PickHandler): () => void {
    handlers.set(listId, handler);
    return () => {
        handlers.delete(listId);
    };
}

/** Each mounted query list's picks, which the window shows again once a row of any list stops lighting up. */
const picksByList = new Map<string, OnshapeSelection[]>();

export function holdPicks(
    listId: string,
    picks: OnshapeSelection[]
): () => void {
    picksByList.set(listId, picks);
    return () => {
        picksByList.delete(listId);
    };
}

/** How each mounted query list asks for its selection request again, once a highlight has ended it. */
const resumers = new Map<string, () => void>();

export function holdResume(listId: string, resume: () => void): () => void {
    resumers.set(listId, resume);
    return () => {
        resumers.delete(listId);
    };
}

export function resumeFocused(): void {
    const { focused } = useOnshapeSelection.getState();
    if (focused !== undefined) {
        resumers.get(focused)?.();
    }
}

/** The focused list's picks; none with no list focused. */
export function focusedPicks(): OnshapeSelection[] {
    const { focused } = useOnshapeSelection.getState();
    return (focused === undefined ? undefined : picksByList.get(focused)) ?? [];
}

export const useOnshapeSelection = create<SelectionState>()((set, get) => ({
    shown: [],
    receive: (selection) => {
        const { shown: previous, awaited, focused } = get();
        set({ shown: selection });
        if (awaited) {
            if (
                keysOf(selection) === awaited.keys ||
                Date.now() > awaited.until
            ) {
                set({ awaited: undefined });
            }
            return;
        }
        if (focused) {
            handlers.get(focused)?.({
                added: without(selection, previous),
                removed: without(previous, selection)
            });
        }
    },
    focus: (listId) => set({ focused: listId })
}));

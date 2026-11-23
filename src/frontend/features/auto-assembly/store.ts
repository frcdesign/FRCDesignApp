/** What Auto Assembly's page holds: its choices, kept between visits, and what's picked, kept for the tab. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
    type ExistingScrew,
    type FastenerMode,
    SelectionMode
} from "@backend/features/auto-assembly/contract";
import { StudioInput } from "@backend/features/auto-assembly/studios";
import { type OnshapeSelection, selectionKey } from "../../lib/selection";
import { type Choices, defaultChoices, Part } from "./options";
import { FormInput } from "./parameters";

interface AutoAssemblyState extends Choices {
    targets: OnshapeSelection[];
    excluded: OnshapeSelection[];
    /** Screws to take out and fasten again. */
    replaced: OnshapeSelection[];
    /** The planar face the Face stop condition stops at: one at most. */
    stopFace: OnshapeSelection[];
    /** The screw's inputs chosen by hand since the last run; the rest follow what's picked. */
    chosenScrewInputs: string[];
    /** The washers and nut changed by hand since the last run; the rest follow the screw picked. */
    chosenParts: Part[];
    /** Keys (`selectionKey`) of the circular edges fastened from the far end of their holes. */
    flipped: string[];
    /** Every screw to update goes in from the other end of its holes. */
    flipScrews: boolean;
    setForm: (id: FormInput, value: string) => void;
    setMode: (mode: FastenerMode) => void;
    setScrew: (id: string, value: string) => void;
    /** The screw's inputs as the picks say, but those chosen by hand. */
    followScrew: (screw: Record<string, string>) => void;
    /** Each washer and the nut added as the existing screw has it, configured as its own, but those chosen by hand. */
    followParts: (existing: ExistingScrew) => void;
    /** Updates this screw alone, with everything following it. */
    updateScrew: (screw: OnshapeSelection) => void;
    toggleFlipped: (entity: OnshapeSelection) => void;
    setFlipScrews: (flipScrews: boolean) => void;
    /** Picks and flips cleared, and the screw free to follow them again, after a run starts. */
    finishRun: () => void;
    setPart: (part: Part, id: string, value: string) => void;
    setAdded: (part: Part, added: boolean) => void;
    setTargets: (targets: OnshapeSelection[]) => void;
    setExcluded: (excluded: OnshapeSelection[]) => void;
    setReplaced: (replaced: OnshapeSelection[]) => void;
    setStopFace: (stopFace: OnshapeSelection[]) => void;
}

/** Every part from a vendor; each settles back to one making it. */
function withVendor(parts: Choices["parts"], vendor: string): Choices["parts"] {
    const vendored = (part: Part) => ({
        ...parts[part],
        [StudioInput.VENDOR]: vendor
    });
    return {
        [Part.SCREW_WASHER]: vendored(Part.SCREW_WASHER),
        [Part.NUT]: vendored(Part.NUT),
        [Part.NUT_WASHER]: vendored(Part.NUT_WASHER)
    };
}

/** The screw with these inputs changed; a new vendor's washers and nuts, where it makes them. */
function withScrew(
    state: Choices,
    changes: Record<string, string>
): Pick<Choices, "screw" | "parts"> {
    const vendor = changes[StudioInput.VENDOR];
    return {
        screw: { ...state.screw, ...changes },
        parts:
            vendor === undefined ? state.parts : withVendor(state.parts, vendor)
    };
}

function withPart(parts: Part[], part: Part): Part[] {
    return parts.includes(part) ? parts : [...parts, part];
}

/** Whether a part is already added, and configured, as the existing screw has it. */
function isFollowing(
    state: Choices,
    part: Part,
    selection: Record<string, string> | undefined
): boolean {
    if (state.added[part] !== (selection !== undefined)) {
        return false;
    }
    return Object.entries(selection ?? {}).every(
        ([id, value]) => state.parts[part][id] === value
    );
}

export const useAutoAssemblyStore = create<AutoAssemblyState>()(
    persist(
        (set) => ({
            ...defaultChoices(),
            targets: [],
            excluded: [],
            replaced: [],
            stopFace: [],
            chosenScrewInputs: [],
            chosenParts: [],
            flipped: [],
            flipScrews: false,
            setForm: (id, value) =>
                set((state) => ({
                    form: { ...state.form, [id]: value },
                    // Picks of one kind mean nothing as the other
                    ...(id === FormInput.SELECT_BY && state.form[id] !== value
                        ? {
                              targets: [],
                              excluded: [],
                              replaced: [],
                              flipped: [],
                              flipScrews: false
                          }
                        : {})
                })),
            setMode: (mode) => set({ mode }),
            setScrew: (id, value) =>
                set((state) => ({
                    ...withScrew(state, { [id]: value }),
                    chosenScrewInputs: state.chosenScrewInputs.includes(id)
                        ? state.chosenScrewInputs
                        : [...state.chosenScrewInputs, id]
                })),
            followScrew: (screw) =>
                set((state) => {
                    const followed = Object.fromEntries(
                        Object.entries(screw).filter(
                            ([id, value]) =>
                                !state.chosenScrewInputs.includes(id) &&
                                state.screw[id] !== value
                        )
                    );
                    return Object.keys(followed).length === 0
                        ? {}
                        : withScrew(state, followed);
                }),
            followParts: (existing) =>
                set((state) => {
                    const followed = Object.values(Part).filter(
                        (part) =>
                            !state.chosenParts.includes(part) &&
                            !isFollowing(state, part, existing[part])
                    );
                    if (followed.length === 0) {
                        return {};
                    }
                    const parts = { ...state.parts };
                    const added = { ...state.added };
                    for (const part of followed) {
                        const selection = existing[part];
                        added[part] = selection !== undefined;
                        parts[part] = { ...parts[part], ...selection };
                    }
                    return { parts, added };
                }),
            updateScrew: (screw) =>
                set((state) => ({
                    form: {
                        ...state.form,
                        [FormInput.SELECT_BY]: SelectionMode.SCREWS
                    },
                    targets: [],
                    excluded: [],
                    replaced: [screw],
                    chosenScrewInputs: [],
                    chosenParts: [],
                    flipped: [],
                    flipScrews: false
                })),
            toggleFlipped: (entity) =>
                set((state) => {
                    const key = selectionKey(entity);
                    return {
                        flipped: state.flipped.includes(key)
                            ? state.flipped.filter((each) => each !== key)
                            : [...state.flipped, key]
                    };
                }),
            setFlipScrews: (flipScrews) => set({ flipScrews }),
            finishRun: () =>
                set({
                    targets: [],
                    excluded: [],
                    replaced: [],
                    chosenScrewInputs: [],
                    chosenParts: [],
                    flipped: [],
                    flipScrews: false
                }),
            setPart: (part, id, value) =>
                set((state) => ({
                    parts: {
                        ...state.parts,
                        [part]: { ...state.parts[part], [id]: value }
                    },
                    chosenParts: withPart(state.chosenParts, part)
                })),
            setAdded: (part, added) =>
                set((state) => ({
                    added: { ...state.added, [part]: added },
                    chosenParts: withPart(state.chosenParts, part)
                })),
            setTargets: (targets) =>
                set((state) => {
                    // An edge picked again starts unflipped
                    const keys = new Set(targets.map(selectionKey));
                    return {
                        targets,
                        flipped: state.flipped.filter((key) => keys.has(key))
                    };
                }),
            setExcluded: (excluded) => set({ excluded }),
            setReplaced: (replaced) => set({ replaced }),
            // A new pick takes the old one's place
            setStopFace: (stopFace) => set({ stopFace: stopFace.slice(-1) })
        }),
        {
            name: "autoAssembly",
            version: 1,
            storage: createJSONStorage(() => localStorage),
            // Picks belong to the assembly open now, not the next one
            partialize: (state): Choices => ({
                form: state.form,
                mode: state.mode,
                screw: state.screw,
                parts: state.parts,
                added: state.added
            }),
            // An earlier version's choices don't fit these; they're settled on read anyway
            migrate: () => defaultChoices()
        }
    )
);

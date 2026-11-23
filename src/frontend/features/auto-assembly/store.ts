/** What Auto Assembly's page holds: its choices, kept between visits, and what's picked, kept for the tab. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type FastenerMode } from "@backend/features/auto-assembly/contract";
import { StudioInput } from "@backend/features/auto-assembly/studios";
import { type OnshapeSelection } from "../../lib/selection";
import { type Choices, defaultChoices, Part } from "./options";
import { FormInput } from "./parameters";

/** Whose input: the screw's, or a washer's or the nut's. */
export type InputOwner = "screw" | Part;

/** An input someone set by hand, as `<owner>.<input id>`. */
export function specifiedKey(owner: InputOwner, id: string): string {
    return `${owner}.${id}`;
}

interface AutoAssemblyState extends Choices {
    targets: OnshapeSelection[];
    excluded: OnshapeSelection[];
    /** Screws to take out and fasten again. */
    replaced: OnshapeSelection[];
    /** The planar face the Face stop condition stops at: one at most. */
    stopFace: OnshapeSelection[];
    /**
     * The inputs set by hand since the panel opened or a run started
     * (`specifiedKey`), as Onshape's editing logic calls them specified: what's
     * picked, and the screw's vendor, set only the rest.
     */
    specified: string[];
    /** The panel opened: nothing is specified yet. */
    open: () => void;
    setForm: (id: FormInput, value: string) => void;
    setMode: (mode: FastenerMode) => void;
    setScrew: (id: string, value: string) => void;
    /** The screw's inputs as the picks say, but those specified. */
    followScrew: (screw: Record<string, string>) => void;
    /** Picks cleared, and nothing specified, after a run starts. */
    finishRun: () => void;
    setPart: (part: Part, id: string, value: string) => void;
    setAdded: (part: Part, added: boolean) => void;
    setTargets: (targets: OnshapeSelection[]) => void;
    setExcluded: (excluded: OnshapeSelection[]) => void;
    setReplaced: (replaced: OnshapeSelection[]) => void;
    setStopFace: (stopFace: OnshapeSelection[]) => void;
}

/** Each washer's and the nut's vendor follows the screw's, but where it's specified; each settles back to one making it. */
function withVendor(
    parts: Choices["parts"],
    vendor: string,
    specified: string[]
): Choices["parts"] {
    const follow = (part: Part) =>
        specified.includes(specifiedKey(part, StudioInput.VENDOR))
            ? parts[part]
            : { ...parts[part], [StudioInput.VENDOR]: vendor };
    return {
        [Part.SCREW_WASHER]: follow(Part.SCREW_WASHER),
        [Part.NUT]: follow(Part.NUT),
        [Part.NUT_WASHER]: follow(Part.NUT_WASHER)
    };
}

/** The screw with these inputs changed, and the editing logic they set off. */
function withScrew(
    state: AutoAssemblyState,
    changes: Record<string, string>
): Pick<Choices, "screw" | "parts"> {
    const vendor = changes[StudioInput.VENDOR];
    return {
        screw: { ...state.screw, ...changes },
        parts:
            vendor === undefined
                ? state.parts
                : withVendor(state.parts, vendor, state.specified)
    };
}

function withSpecified(specified: string[], key: string): string[] {
    return specified.includes(key) ? specified : [...specified, key];
}

export const useAutoAssemblyStore = create<AutoAssemblyState>()(
    persist(
        (set) => ({
            ...defaultChoices(),
            targets: [],
            excluded: [],
            replaced: [],
            stopFace: [],
            specified: [],
            open: () => set({ specified: [] }),
            setForm: (id, value) =>
                set((state) => ({
                    form: { ...state.form, [id]: value },
                    // Picks of one kind mean nothing as the other
                    ...(id === FormInput.SELECT_BY && state.form[id] !== value
                        ? { targets: [], excluded: [], replaced: [] }
                        : {})
                })),
            setMode: (mode) => set({ mode }),
            setScrew: (id, value) =>
                set((state) => ({
                    ...withScrew(state, { [id]: value }),
                    specified: withSpecified(
                        state.specified,
                        specifiedKey("screw", id)
                    )
                })),
            followScrew: (screw) =>
                set((state) => {
                    const followed = Object.fromEntries(
                        Object.entries(screw).filter(
                            ([id, value]) =>
                                !state.specified.includes(
                                    specifiedKey("screw", id)
                                ) && state.screw[id] !== value
                        )
                    );
                    return Object.keys(followed).length === 0
                        ? {}
                        : withScrew(state, followed);
                }),
            finishRun: () =>
                set({ targets: [], excluded: [], replaced: [], specified: [] }),
            setPart: (part, id, value) =>
                set((state) => ({
                    parts: {
                        ...state.parts,
                        [part]: { ...state.parts[part], [id]: value }
                    },
                    specified: withSpecified(
                        state.specified,
                        specifiedKey(part, id)
                    )
                })),
            setAdded: (part, added) =>
                set((state) => ({ added: { ...state.added, [part]: added } })),
            setTargets: (targets) => set({ targets }),
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

/** What Auto Assembly's page holds: its choices, kept between visits, and what's picked, kept for the tab. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type FastenerMode } from "@backend/features/auto-assembly/contract";
import { StudioInput } from "@backend/features/auto-assembly/studios";
import { type OnshapeSelection } from "../../lib/selection";
import { type Choices, defaultChoices, Part } from "./options";
import { FormInput } from "./parameters";

interface AutoAssemblyState extends Choices {
    targets: OnshapeSelection[];
    excluded: OnshapeSelection[];
    setForm: (id: FormInput, value: string) => void;
    setMode: (mode: FastenerMode) => void;
    setScrew: (id: string, value: string) => void;
    setPart: (part: Part, id: string, value: string) => void;
    setAdded: (part: Part, added: boolean) => void;
    setTargets: (targets: OnshapeSelection[]) => void;
    setExcluded: (excluded: OnshapeSelection[]) => void;
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

export const useAutoAssemblyStore = create<AutoAssemblyState>()(
    persist(
        (set) => ({
            ...defaultChoices(),
            targets: [],
            excluded: [],
            setForm: (id, value) =>
                set((state) => ({
                    form: { ...state.form, [id]: value },
                    // Picks of one kind mean nothing as the other
                    ...(id === FormInput.SELECT_BY && state.form[id] !== value
                        ? { targets: [], excluded: [] }
                        : {})
                })),
            setMode: (mode) => set({ mode }),
            setScrew: (id, value) =>
                set((state) => ({
                    screw: { ...state.screw, [id]: value },
                    // A new vendor's washers and nuts, where it makes them
                    ...(id === StudioInput.VENDOR
                        ? { parts: withVendor(state.parts, value) }
                        : {})
                })),
            setPart: (part, id, value) =>
                set((state) => ({
                    parts: {
                        ...state.parts,
                        [part]: { ...state.parts[part], [id]: value }
                    }
                })),
            setAdded: (part, added) =>
                set((state) => ({ added: { ...state.added, [part]: added } })),
            setTargets: (targets) => set({ targets }),
            setExcluded: (excluded) => set({ excluded })
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

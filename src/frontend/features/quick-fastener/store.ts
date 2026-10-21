/** What Quick fastener's page holds: its options and how it picks, kept between visits, and what's picked, kept for the tab. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
    type FastenerOptions,
    SelectionMode
} from "@backend/features/quick-fastener/contract";
import { type OnshapeSelection } from "../../lib/selection";
import { consistentOptions, defaultOptions } from "./options";

interface QuickFastenerState {
    options: FastenerOptions;
    selectionMode: SelectionMode;
    targets: OnshapeSelection[];
    excluded: OnshapeSelection[];
    setOptions: (changed: Partial<FastenerOptions>) => void;
    setSelectionMode: (mode: SelectionMode) => void;
    setTargets: (targets: OnshapeSelection[]) => void;
    setExcluded: (excluded: OnshapeSelection[]) => void;
}

export const useQuickFastenerStore = create<QuickFastenerState>()(
    persist(
        (set) => ({
            options: defaultOptions(),
            selectionMode: SelectionMode.FACES,
            targets: [],
            excluded: [],
            setOptions: (changed) =>
                set((state) => ({
                    options: consistentOptions({ ...state.options, ...changed })
                })),
            // Picks of one kind mean nothing as the other
            setSelectionMode: (selectionMode) =>
                set({ selectionMode, targets: [], excluded: [] }),
            setTargets: (targets) => set({ targets }),
            setExcluded: (excluded) => set({ excluded })
        }),
        {
            name: "quickFastener",
            storage: createJSONStorage(() => localStorage),
            // Picks belong to the assembly open now, not the next one
            partialize: (state) => ({
                options: state.options,
                selectionMode: state.selectionMode
            }),
            merge: (persisted, current) => {
                const saved = persisted as Partial<QuickFastenerState>;
                return {
                    ...current,
                    selectionMode: saved.selectionMode ?? current.selectionMode,
                    options: consistentOptions({
                        ...current.options,
                        ...saved.options
                    })
                };
            }
        }
    )
);

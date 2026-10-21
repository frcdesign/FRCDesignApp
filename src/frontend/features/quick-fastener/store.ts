/** What Quick fastener's page holds: its options, kept between visits, and what's picked, kept for the tab. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type FastenerOptions } from "@backend/features/quick-fastener/contract";
import { type OnshapeSelection } from "../../lib/selection";
import { consistentOptions, defaultOptions } from "./options";

interface QuickFastenerState {
    options: FastenerOptions;
    targets: OnshapeSelection[];
    excluded: OnshapeSelection[];
    setOptions: (changed: Partial<FastenerOptions>) => void;
    setTargets: (targets: OnshapeSelection[]) => void;
    setExcluded: (excluded: OnshapeSelection[]) => void;
}

export const useQuickFastenerStore = create<QuickFastenerState>()(
    persist(
        (set) => ({
            options: defaultOptions(),
            targets: [],
            excluded: [],
            setOptions: (changed) =>
                set((state) => ({
                    options: consistentOptions({ ...state.options, ...changed })
                })),
            setTargets: (targets) => set({ targets }),
            setExcluded: (excluded) => set({ excluded })
        }),
        {
            name: "quickFastener",
            storage: createJSONStorage(() => localStorage),
            // Picks belong to the assembly open now, not the next one
            partialize: (state) => ({ options: state.options }),
            merge: (persisted, current) => ({
                ...current,
                options: consistentOptions({
                    ...current.options,
                    ...(persisted as Partial<QuickFastenerState>).options
                })
            })
        }
    )
);

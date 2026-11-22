import { create } from "zustand";

interface PanelFooterState {
    /** How many are mounted: while any is, the selecting bar shows in it. */
    count: number;
}

export const usePanelFooter = create<PanelFooterState>(() => ({ count: 0 }));

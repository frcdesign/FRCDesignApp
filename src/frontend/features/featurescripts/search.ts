import { create } from "zustand";

interface FeatureScriptsSearch {
    query: string;
    setQuery: (query: string) => void;
}

/** What the navbar's search box holds, which the list filters by; not kept past the page. */
export const useFeatureScriptsSearch = create<FeatureScriptsSearch>()(
    (set) => ({
        query: "",
        setQuery: (query) => set({ query })
    })
);

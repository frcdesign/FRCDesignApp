import { create } from "zustand";
import type { IndexingSettings } from "@backend/features/build-checker/contract";

/** An admin's edits, holding only what differs from what is stored. */
type IndexingDraft = Partial<IndexingSettings>;

/**
 * Edits not yet saved, by insertable. Kept outside the card, so moving off it
 * and back doesn't lose them; in memory only, since a reload may have changed
 * what they were made against.
 */
const useIndexingDrafts = create<Record<string, IndexingDraft>>(() => ({}));

/** What the card shows and saves: the stored settings with the draft laid over them. */
export interface IndexingView extends IndexingSettings {
    /** Each flipped switch or parameter; 0 when there is nothing to save. */
    changeCount: number;
}

export function useIndexingView(
    insertableId: string,
    status: IndexingSettings
): IndexingView {
    const draft = useIndexingDrafts((drafts) => drafts[insertableId]);
    return toView(status, draft ?? {});
}

function toView(status: IndexingSettings, draft: IndexingDraft): IndexingView {
    const indexConfigurations =
        draft.indexConfigurations ?? status.indexConfigurations;
    const excludedParameterIds =
        draft.excludedParameterIds ?? status.excludedParameterIds;
    const changeCount =
        Number(indexConfigurations !== status.indexConfigurations) +
        symmetricDifference(excludedParameterIds, status.excludedParameterIds);
    return { indexConfigurations, excludedParameterIds, changeCount };
}

function symmetricDifference(a: string[], b: string[]): number {
    return (
        a.filter((id) => !b.includes(id)).length +
        b.filter((id) => !a.includes(id)).length
    );
}

/** Whether there is anything to save, for the dot on the card's badge. */
export function useHasIndexingDraft(insertableId: string): boolean {
    return useIndexingDrafts((drafts) => drafts[insertableId] !== undefined);
}

/** Merges an edit in; a draft that changes nothing is dropped, which clears the dot. */
export function editIndexingDraft(
    insertableId: string,
    status: IndexingSettings,
    edit: IndexingDraft
): void {
    useIndexingDrafts.setState((drafts) => {
        const draft = { ...drafts[insertableId], ...edit };
        const rest = without(drafts, insertableId);
        return toView(status, draft).changeCount > 0
            ? { ...rest, [insertableId]: draft }
            : rest;
    }, true);
}

export function clearIndexingDraft(insertableId: string): void {
    useIndexingDrafts.setState((drafts) => without(drafts, insertableId), true);
}

function without(
    drafts: Record<string, IndexingDraft>,
    insertableId: string
): Record<string, IndexingDraft> {
    return Object.fromEntries(
        Object.entries(drafts).filter(([id]) => id !== insertableId)
    );
}

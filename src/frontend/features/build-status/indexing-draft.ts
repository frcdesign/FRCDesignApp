import { create } from "zustand";
import type { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import type { IndexingChange } from "./queries";

/**
 * Edits not yet applied, by insertable. Kept outside the card, so moving off it
 * and back doesn't lose them; in memory only, since a reload may have changed
 * what they were made against.
 */
const useIndexingDrafts = create<Record<string, IndexingChange>>(() => ({}));

/** What the card shows: the stored settings with the draft laid over them. */
export interface IndexingView {
    indexConfigurations: boolean;
    excludedParameterIds: string[];
    /** Only what differs from what is stored; empty when there is nothing to apply. */
    change: IndexingChange;
    changeCount: number;
}

export function useIndexingView(
    insertableId: string,
    status: InsertableBuildStatus
): IndexingView {
    const draft = useIndexingDrafts((drafts) => drafts[insertableId]);
    return toView(status, draft ?? {});
}

function toView(
    status: InsertableBuildStatus,
    draft: IndexingChange
): IndexingView {
    const indexConfigurations =
        draft.indexConfigurations ?? status.indexConfigurations;
    const excludedParameterIds =
        draft.excludedParameterIds ?? status.excludedParameterIds;

    const change: IndexingChange = {};
    let changeCount = 0;
    if (indexConfigurations !== status.indexConfigurations) {
        change.indexConfigurations = indexConfigurations;
        changeCount += 1;
    }
    const stored = new Set(status.excludedParameterIds);
    const flipped =
        excludedParameterIds.filter((id) => !stored.has(id)).length +
        status.excludedParameterIds.filter(
            (id) => !excludedParameterIds.includes(id)
        ).length;
    if (flipped > 0) {
        change.excludedParameterIds = excludedParameterIds;
        changeCount += flipped;
    }
    return { indexConfigurations, excludedParameterIds, change, changeCount };
}

/** Merges an edit in, dropping whatever it returns to the stored value. */
export function editIndexingDraft(
    insertableId: string,
    status: InsertableBuildStatus,
    edit: IndexingChange
): void {
    useIndexingDrafts.setState((drafts) => {
        const { change } = toView(status, { ...drafts[insertableId], ...edit });
        const rest = without(drafts, insertableId);
        return Object.keys(change).length > 0
            ? { ...rest, [insertableId]: change }
            : rest;
    }, true);
}

export function clearIndexingDraft(insertableId: string): void {
    useIndexingDrafts.setState((drafts) => without(drafts, insertableId), true);
}

function without(
    drafts: Record<string, IndexingChange>,
    insertableId: string
): Record<string, IndexingChange> {
    return Object.fromEntries(
        Object.entries(drafts).filter(([id]) => id !== insertableId)
    );
}

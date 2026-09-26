/**
 * What the app shows and remembers in this browser. Components read it through
 * `useUiState` with a selector, so each re-renders only for its own fields.
 * The Onshape launch, which is per tab, is `useOnshapeLaunch`.
 */
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { Vendor } from "@backend/features/library/vendors";
import { AppTabType } from "./app-tab";
import { createPersistedStore } from "./persisted-store";

export enum Theme {
    DARK = "dark",
    LIGHT = "light"
}

/** Kept until the browser's storage is cleared. */
const UiStateSchema = z.object({
    theme: z.enum(Theme).catch(Theme.DARK),
    /** Undefined until one is picked, which the welcome asks for. */
    tabId: AppTabType.optional().catch(undefined),
    /** The group last opened in that tab; undefined for the tab itself. */
    groupId: z.string().optional().catch(undefined),
    isFavoritesOpen: z.boolean().catch(false),
    isLibraryOpen: z.boolean().catch(true),
    /** Per library; a library with no entry has every vendor active. */
    vendorFilters: z
        .partialRecord(z.enum(LibraryId), z.array(z.enum(Vendor)))
        .catch({}),
    searchQuery: z.string().catch(""),
    fasten: z.boolean().catch(true),
    /** The access level to view the app as; absent means the granted default. */
    accessLevel: z.enum(AccessLevel).optional().catch(undefined),
    /** So a relaunch can reopen the insert menu. */
    openInsertableId: z.string().optional().catch(undefined),
    openSelection: z
        .partialRecord(z.string(), z.string())
        .optional()
        .catch(undefined),
    openFavoriteId: z.string().optional().catch(undefined)
});

export const useUiState = createPersistedStore(
    UiStateSchema,
    "uiState",
    () => window.localStorage
);

export function getUiState() {
    return useUiState.getState();
}

export function updateUiState(
    update: Partial<ReturnType<typeof getUiState>>
): void {
    useUiState.setState(update);
}

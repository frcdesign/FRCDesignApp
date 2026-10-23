/**
 * What the app shows and remembers in this browser. Components read it through
 * `useUiState` with a selector, so each re-renders only for its own fields.
 * The Onshape launch, which is per tab, is `useOnshapeLaunch`.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessLevel } from "@backend/features/auth/access-level";
import type { LibraryId } from "@backend/features/library/library-id";
import type { Vendor } from "@backend/features/library/vendors";
import type { PartialSelection } from "@backend/features/configurations/contract";
import type { AppTab } from "./app-tab";
import { SelectionMode } from "@backend/features/quick-fastener/contract";

export enum Theme {
    DARK = "dark",
    LIGHT = "light"
}

interface UiState {
    theme: Theme;
    /** Undefined until one is picked, which the welcome asks for. */
    tabId?: AppTab;
    /** The group last opened in that tab; undefined for the tab itself. */
    groupId?: string;
    isFavoritesOpen: boolean;
    isLibraryOpen: boolean;
    /** The version manager's two sections, which open like the home page's. */
    isParentsOpen: boolean;
    isChildrenOpen: boolean;
    /** How many times the version manager has offered its quick-action tip;
     * see `version-manager-tips`. */
    quickActionTipCount: number;
    /** Per library; a library with no entry has every vendor active. */
    vendorFilters: Partial<Record<LibraryId, Vendor[]>>;
    searchQuery: string;
    fasten: boolean;
    /** What an insert and fasten's picks are: circular edges, or faces with holes to skip. */
    fastenSelectionMode: SelectionMode;
    /** Fastening to several circular edges replicates, where the part allows it. */
    replicate: boolean;
    /** How many times an insert and fasten has offered the circular edges tip; see `insert-tips`. */
    fastenCircularEdgesTipCount: number;
    /** The access level to view the app as; absent means the granted default. */
    accessLevel?: AccessLevel;
    /** So a relaunch can reopen the insert menu. */
    openInsertableId?: string;
    openSelection?: PartialSelection;
    openFavoriteId?: string;
}

/** In localStorage, the persist default. */
export const useUiState = create<UiState>()(
    persist(
        (): UiState => ({
            theme: Theme.DARK,
            isFavoritesOpen: false,
            isLibraryOpen: true,
            isParentsOpen: true,
            isChildrenOpen: true,
            quickActionTipCount: 0,
            vendorFilters: {},
            searchQuery: "",
            fasten: true,
            fastenSelectionMode: SelectionMode.LOCATIONS,
            replicate: false,
            fastenCircularEdgesTipCount: 0
        }),
        { name: "uiState" }
    )
);

export function getUiState(): UiState {
    return useUiState.getState();
}

export function updateUiState(update: Partial<UiState>): void {
    useUiState.setState(update);
}

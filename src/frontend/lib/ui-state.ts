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

export enum Theme {
    DARK = "dark",
    LIGHT = "light"
}

/** Every folding section whose open state is remembered, on a page or in a card. */
export enum SectionId {
    FAVORITES = "favorites",
    RECENTS = "recents",
    LIBRARY = "library",
    /** The version manager's two lists. */
    PARENTS = "parents",
    CHILDREN = "children",
    /** The admin card's. */
    BUILD_CHECKS = "build-checks",
    SETTINGS = "settings",
    CONFIGURATION = "configuration",
    USAGE = "usage"
}

/** Until someone opens or closes it. Favorites and Configuration are long, and wanted less. */
const OPENED_BY_DEFAULT: Record<SectionId, boolean> = {
    [SectionId.FAVORITES]: false,
    [SectionId.RECENTS]: true,
    [SectionId.LIBRARY]: true,
    [SectionId.PARENTS]: true,
    [SectionId.CHILDREN]: true,
    [SectionId.BUILD_CHECKS]: true,
    [SectionId.SETTINGS]: true,
    [SectionId.CONFIGURATION]: false,
    [SectionId.USAGE]: true
};

interface UiState {
    theme: Theme;
    /** Undefined until one is picked, which the welcome asks for. */
    tabId?: AppTab;
    /** The group last opened in that tab; undefined for the tab itself. */
    groupId?: string;
    /** Sections someone opened or closed; the rest are at their default. */
    sections: Partial<Record<SectionId, boolean>>;
    /** Per library; a library with no entry has every vendor active. */
    vendorFilters: Partial<Record<LibraryId, Vendor[]>>;
    searchQuery: string;
    fasten: boolean;
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
            sections: {},
            vendorFilters: {},
            searchQuery: "",
            fasten: true
        }),
        { name: "uiState", version: 1, migrate: migrateUiState }
    )
);

/** Version 0 kept a boolean per page section; they move into `sections`. */
export function migrateUiState(persisted: unknown, version: number): UiState {
    const state = persisted as UiState & Record<string, unknown>;
    if (version >= 1) return state;
    const {
        isFavoritesOpen,
        isRecentsOpen,
        isLibraryOpen,
        isParentsOpen,
        isChildrenOpen,
        ...rest
    } = state;
    const sections: Partial<Record<SectionId, boolean>> = {};
    const carried: [SectionId, unknown][] = [
        [SectionId.FAVORITES, isFavoritesOpen],
        [SectionId.RECENTS, isRecentsOpen],
        [SectionId.LIBRARY, isLibraryOpen],
        [SectionId.PARENTS, isParentsOpen],
        [SectionId.CHILDREN, isChildrenOpen]
    ];
    for (const [id, opened] of carried) {
        if (typeof opened === "boolean") sections[id] = opened;
    }
    return { ...rest, sections };
}

export function useSectionOpened(id: SectionId): boolean {
    return useUiState((state) => state.sections[id] ?? OPENED_BY_DEFAULT[id]);
}

export function setSectionOpened(id: SectionId, opened: boolean): void {
    useUiState.setState((state) => ({
        sections: { ...state.sections, [id]: opened }
    }));
}

export function getUiState(): UiState {
    return useUiState.getState();
}

export function updateUiState(update: Partial<UiState>): void {
    useUiState.setState(update);
}

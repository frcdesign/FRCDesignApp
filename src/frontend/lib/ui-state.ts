import { useSyncExternalStore } from "react";
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { Vendor } from "@backend/features/library/vendors";
import { DEFAULT_SETTINGS, Theme } from "@backend/features/settings/settings";

// Increment this when a breaking change is made to the schema
const LATEST_VERSION = 3;

const VendorType = z.enum(Object.values(Vendor));
const AccessLevelType = z.enum(Object.values(AccessLevel));
const ThemeType = z.enum(Object.values(Theme));
const LibraryIdType = z.enum(Object.values(LibraryId));

const UiStateSchema = z.object({
    version: z.number().default(1), // We can't default the parsed version to LATEST_VERSION because of old versions floating around
    isFavoritesOpen: z.boolean().default(false),
    isLibraryOpen: z.boolean().default(true),
    vendorFilters: z.array(VendorType).optional(),
    searchQuery: z.string().default(""),
    fasten: z.boolean().default(true),
    /** The access level to view the app as; absent means the granted default. */
    accessLevel: AccessLevelType.optional(),
    /** Set on leaving for Onshape, so the app can confirm the sign-in on return. */
    justSignedIn: z.boolean().default(false),
    // The caller's settings, which this is the source of truth for. A signed-in
    // caller also has them server-side, which is what a browser that has never
    // run the app starts from.
    theme: ThemeType.default(DEFAULT_SETTINGS.theme),
    libraryId: LibraryIdType.default(DEFAULT_SETTINGS.libraryId),
    /** The group last opened in that library; null for the library itself. */
    groupId: z.string().nullable().default(DEFAULT_SETTINGS.groupId)
});

export type UiState = z.infer<typeof UiStateSchema>;

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();

let uiStateCache: UiState | null = null;

function setUiState(uiState: UiState) {
    const parsed = UiStateSchema.parse(uiState);

    // Sets always set latest version
    parsed.version = LATEST_VERSION;

    // Only update if changed
    if (
        uiStateCache === null ||
        JSON.stringify(parsed) !== JSON.stringify(uiStateCache)
    ) {
        uiStateCache = parsed;
        writeStorage(JSON.stringify(parsed));
        subscribers.forEach((callback) => callback());
    }
}

/** Blocked or partitioned storage must not break the app, only its memory. */
function readStorage(): string | null {
    try {
        return window.localStorage.getItem("uiState");
    } catch {
        return null;
    }
}

function writeStorage(value: string): void {
    try {
        window.localStorage.setItem("uiState", value);
    } catch {
        // Nothing to do; the in-memory cache still serves this session.
    }
}

/**
 * Asynchronously retrieves the current UI state.
 */
export function getUiState(): UiState {
    if (uiStateCache) return uiStateCache;

    const raw = readStorage();
    // Nothing in storage, initialize with defaults
    if (!raw) {
        uiStateCache = UiStateSchema.parse({});
        return uiStateCache;
    }

    uiStateCache = UiStateSchema.parse(
        // Convert null to undefined for optional fields
        JSON.parse(raw, (_key, value) => value ?? undefined)
    );

    if (uiStateCache.version < LATEST_VERSION) {
        // Always reset to defaults for simplicity
        // Updated version will get set in the next version
        uiStateCache = UiStateSchema.parse({});
    }
    return uiStateCache;
}

function subscribeToUiState(callback: Subscriber) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

/**
 * Asynchronously updates the current UI state.
 */
export function updateUiState(partialState: Partial<UiState>): UiState {
    const newState = {
        ...getUiState(),
        ...partialState,
        version: LATEST_VERSION
    };
    setUiState(newState);
    return newState;
}

export type SetUiState = (uiState: Partial<UiState>) => void;

/** The current state, re-rendering the caller whenever it changes. */
export function useGetUiState(): UiState {
    return useSyncExternalStore(subscribeToUiState, getUiState);
}

/** Merges into the state; every reader of it re-renders. */
// The setter half of the pair above: a component reaches for one or the other,
// so both read as hooks even though setting needs no state of its own.
// eslint-disable-next-line react-x/no-unnecessary-use-prefix
export function useSetUiState(): SetUiState {
    return updateUiState;
}

import { useSyncExternalStore } from "react";
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { Vendor } from "@backend/features/library/vendors";
import { DEFAULT_SETTINGS, Theme } from "@backend/features/settings/settings";

/** Bumped when a change to the schema makes stored state unusable. */
const LATEST_VERSION = 3;

const STORAGE_KEY = "uiState";

const VendorType = z.enum(Object.values(Vendor));
const AccessLevelType = z.enum(Object.values(AccessLevel));
const ThemeType = z.enum(Object.values(Theme));
const LibraryIdType = z.enum(Object.values(LibraryId));

const UiStateSchema = z.object({
    // Defaulted to the first version rather than the latest: state stored
    // before the field existed is old state, not current state.
    version: z.number().default(1),
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

/** The state this session is working from; the store is written behind it. */
let currentState: UiState | null = null;

const defaultState = (): UiState => UiStateSchema.parse({});

/** Blocked or partitioned storage must not break the app, only its memory. */
function readStorage(): string | null {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStorage(value: string): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
        // Nothing to do; the in-memory cache still serves this session.
    }
}

/**
 * What was stored, or the defaults when it cannot be used: written by an older
 * version, hand-edited, or naming something the app has since dropped. Losing a
 * preference beats failing to start.
 */
function readStoredState(): UiState {
    const raw = readStorage();
    if (!raw) {
        return defaultState();
    }
    try {
        const parsed = UiStateSchema.safeParse(
            // A stored null reads as absent, which is what a default fills.
            JSON.parse(raw, (_key, value) => value ?? undefined)
        );
        return parsed.success && parsed.data.version >= LATEST_VERSION
            ? parsed.data
            : defaultState();
    } catch {
        return defaultState();
    }
}

export function getUiState(): UiState {
    currentState ??= readStoredState();
    return currentState;
}

function subscribeToUiState(callback: Subscriber) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

/** Merges into the state, stores it, and tells every reader it changed. */
export function updateUiState(partialState: Partial<UiState>): UiState {
    const newState: UiState = {
        ...getUiState(),
        ...partialState,
        // Writing always stamps the version the shape actually has.
        version: LATEST_VERSION
    };
    if (JSON.stringify(newState) === JSON.stringify(currentState)) {
        return newState;
    }
    currentState = newState;
    writeStorage(JSON.stringify(newState));
    subscribers.forEach((callback) => callback());
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

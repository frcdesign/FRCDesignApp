import { useSyncExternalStore } from "react";
import * as z from "zod";
import { Vendor } from "../../shared/types";

// Increment this when a breaking change is made to the schema
const LATEST_VERSION = 3;

const VendorType = z.enum(Object.values(Vendor));

const UiStateSchema = z.object({
    version: z.number().default(1), // We can't default the parsed version to LATEST_VERSION because of old versions floating around
    isFavoritesOpen: z.boolean().default(false),
    isLibraryOpen: z.boolean().default(true),
    vendorFilters: z.array(VendorType).optional(),
    searchQuery: z.string().default(""),
    openGroupId: z.string().optional(),
    fasten: z.boolean().default(true)
});

type UiState = z.infer<typeof UiStateSchema>;

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

export function useUiState(): [UiState, SetUiState] {
    // Create a react version of the state to trigger re-renders
    const reactUiState = useSyncExternalStore(subscribeToUiState, getUiState);

    return [reactUiState, updateUiState];
}

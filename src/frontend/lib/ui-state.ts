import { useSyncExternalStore } from "react";
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { Vendor } from "@backend/features/library/vendors";
import { DEFAULT_SETTINGS, Theme } from "@backend/features/settings/settings";

/** Bumped when a change to the schema makes stored state unusable. */
const LATEST_VERSION = 4;

const VendorType = z.enum(Object.values(Vendor));
const AccessLevelType = z.enum(Object.values(AccessLevel));
const ThemeType = z.enum(Object.values(Theme));
const LibraryIdType = z.enum(Object.values(LibraryId));

/** Kept until the browser's storage is cleared: preferences, and where to resume. */
const LocalStateSchema = z.object({
    isFavoritesOpen: z.boolean().default(false),
    isLibraryOpen: z.boolean().default(true),
    /** Vendor filters per library, so switching libraries keeps each one's;
     * a library with no entry has every vendor active. */
    vendorFilters: z
        .partialRecord(LibraryIdType, z.array(VendorType))
        .default({}),
    searchQuery: z.string().default(""),
    fasten: z.boolean().default(true),
    /** The access level to view the app as; absent means the granted default. */
    accessLevel: AccessLevelType.optional(),
    // The caller's settings, and the source of truth for them; a signed-in
    // caller's row is what a browser that has never run the app starts from.
    theme: ThemeType.default(DEFAULT_SETTINGS.theme),
    libraryId: LibraryIdType.default(DEFAULT_SETTINGS.libraryId),
    /** The group last opened in that library; null for the library itself. */
    groupId: z.string().nullable().default(DEFAULT_SETTINGS.groupId),
    /** The insertable whose insert menu is open, and what it is configured to.
     * Written as the menu opens and closes, so a relaunch can reopen it. */
    openInsertableId: z.string().optional(),
    /** Absent for the element's own defaults, which is the empty key. */
    openConfigurationKey: z.string().optional(),
    /** Set when the menu was opened from a favorite rather than a row. */
    openFavoriteId: z.string().optional()
});

/** Kept for this tab only, being about this visit rather than this browser. */
const SessionStateSchema = z.object({
    /** Set on leaving for Onshape, so the app can confirm the sign-in on
     * return — and only in the tab that left, which a second one did not. */
    justSignedIn: z.boolean().default(false)
});

type LocalState = z.infer<typeof LocalStateSchema>;
type SessionState = z.infer<typeof SessionStateSchema>;
type UiState = LocalState & SessionState;

/**
 * One store's half of the state: which fields it owns, and how long they last.
 * Held apart so a field's scope is declared once, beside the field.
 */
interface StateArea {
    storageKey: string;
    schema: z.ZodObject;
    /** Read at call time: touching a blocked store is what throws. */
    getStorage: () => Storage;
}

const LOCAL_AREA: StateArea = {
    storageKey: "uiState",
    schema: LocalStateSchema,
    getStorage: () => window.localStorage
};

const SESSION_AREA: StateArea = {
    storageKey: "uiSessionState",
    schema: SessionStateSchema,
    getStorage: () => window.sessionStorage
};

const AREAS = [LOCAL_AREA, SESSION_AREA];

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();

/** The state this session is working from; the stores are written behind it. */
let currentState: UiState | null = null;

/** Blocked or partitioned storage must not break the app, only its memory. */
function readStorage(area: StateArea): string | null {
    try {
        return area.getStorage().getItem(area.storageKey);
    } catch {
        return null;
    }
}

function writeStorage(area: StateArea, value: string): void {
    try {
        area.getStorage().setItem(area.storageKey, value);
    } catch {
        // Nothing to do; the in-memory cache still serves this session.
    }
}

/**
 * What one area stored, or its defaults when that cannot be used — older,
 * hand-edited, or naming something dropped. Losing a preference beats failing
 * to start. The version is read off the raw blob rather than the schema, being
 * about the stored shape rather than anything the app reads.
 */
function readArea(area: StateArea): Record<string, unknown> {
    const defaults = () => area.schema.parse({});
    const raw = readStorage(area);
    if (!raw) {
        return defaults();
    }
    try {
        // A stored null reads as absent, which is what a default fills.
        const stored = JSON.parse(
            raw,
            (_key, value: unknown) => value ?? undefined
        ) as { version?: number };
        if ((stored.version ?? 1) < LATEST_VERSION) {
            return defaults();
        }
        const parsed = area.schema.safeParse(stored);
        return parsed.success ? parsed.data : defaults();
    } catch {
        return defaults();
    }
}

function writeArea(area: StateArea, state: UiState): void {
    const stored: Record<string, unknown> = { version: LATEST_VERSION };
    for (const key of Object.keys(area.schema.shape)) {
        stored[key] = state[key as keyof UiState];
    }
    writeStorage(area, JSON.stringify(stored));
}

export function getUiState(): UiState {
    currentState ??= {
        ...readArea(LOCAL_AREA),
        ...readArea(SESSION_AREA)
    } as UiState;
    return currentState;
}

function subscribeToUiState(callback: Subscriber) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

/** The fields the update names whose value is not already what it says. */
function changedKeys(
    current: UiState,
    partialState: Partial<UiState>
): string[] {
    return Object.keys(partialState).filter((key) => {
        const typedKey = key as keyof UiState;
        // Compared by value for the one object-valued field, which is rebuilt
        // rather than mutated; the rest are primitives.
        return typedKey === "vendorFilters"
            ? JSON.stringify(current[typedKey]) !==
                  JSON.stringify(partialState[typedKey])
            : current[typedKey] !== partialState[typedKey];
    });
}

/** Merges into the state, stores it, and tells every reader it changed. */
export function updateUiState(partialState: Partial<UiState>): UiState {
    const current = getUiState();
    const changed = changedKeys(current, partialState);
    if (changed.length === 0) {
        return current;
    }
    const newState: UiState = { ...current, ...partialState };
    currentState = newState;
    for (const area of AREAS) {
        if (changed.some((key) => key in area.schema.shape)) {
            writeArea(area, newState);
        }
    }
    subscribers.forEach((callback) => callback());
    return newState;
}

/** The current state, re-rendering the caller whenever it changes. */
export function useGetUiState(): UiState {
    return useSyncExternalStore(subscribeToUiState, getUiState);
}

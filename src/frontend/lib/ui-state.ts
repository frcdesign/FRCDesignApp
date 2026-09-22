import { useSyncExternalStore } from "react";
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { Vendor } from "@backend/features/library/vendors";
import { DEFAULT_SETTINGS, Theme } from "@backend/features/settings/settings";
import { OnshapeLaunchType } from "./onshape-launch";

/** Bumped when a change to the schema makes stored state unusable. */
const LATEST_VERSION = 4;

const VendorType = z.enum(Object.values(Vendor));
const AccessLevelType = z.enum(Object.values(AccessLevel));
const ThemeType = z.enum(Object.values(Theme));
const LibraryIdType = z.enum(Object.values(LibraryId));

/**
 * Kept locally and pushed to the caller's row, so a browser that has never run
 * the app starts where their last one left off. The store is still what the app
 * reads: the row is the copy, and the entry redirect is what seeds it back.
 */
const SyncedStateSchema = z.object({
    theme: ThemeType.default(DEFAULT_SETTINGS.theme),
    libraryId: LibraryIdType.default(DEFAULT_SETTINGS.libraryId),
    /** The group last opened in that library; null for the library itself. */
    groupId: z.string().nullable().default(DEFAULT_SETTINGS.groupId),
    /** Whether the program prompt has been answered, which is what stops it
     * being asked again. */
    libraryChosen: z.boolean().default(DEFAULT_SETTINGS.libraryChosen)
});

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
    justSignedIn: z.boolean().default(false),
    // What Onshape launched this panel with: a tab switch replaces it, and
    // another browser tab is another document, with a store of its own.
    ...OnshapeLaunchType.shape
});

type LocalState = z.infer<typeof LocalStateSchema>;
type SessionState = z.infer<typeof SessionStateSchema>;
type SyncedState = z.infer<typeof SyncedStateSchema>;
type UiState = LocalState & SessionState & SyncedState;

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
    // Synced fields are local too, and in the same blob: their scope is about
    // where else they go, not where they are kept — and moving them to a blob
    // of their own would reset the preferences already stored in this one.
    schema: z.object({
        ...LocalStateSchema.shape,
        ...SyncedStateSchema.shape
    }),
    getStorage: () => window.localStorage
};

const SESSION_AREA: StateArea = {
    storageKey: "uiSessionState",
    schema: SessionStateSchema,
    getStorage: () => window.sessionStorage
};

const AREAS = [LOCAL_AREA, SESSION_AREA];

const SYNCED_KEYS = Object.keys(SyncedStateSchema.shape);

type SettingsSync = (settings: Partial<SyncedState>) => void;

let settingsSync: SettingsSync | undefined;

/**
 * Installed at startup by the feature that owns the caller's row, which keeps
 * the endpoint — and the sign-in it needs — out of here.
 */
export function setSettingsSync(sync: SettingsSync): void {
    settingsSync = sync;
}

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

interface UpdateOptions {
    /**
     * False for a value the caller's row already holds — the entry redirect
     * seeding the theme — which would otherwise be posted straight back.
     * @default true
     */
    sync?: boolean;
}

/** Merges into the state, stores it, and tells every reader it changed. */
export function updateUiState(
    partialState: Partial<UiState>,
    options: UpdateOptions = {}
): UiState {
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
    // Only what moved: the row is written for a field the caller changed, not
    // for every field that happened to ride along with it.
    const syncedChanges = changed.filter((key) => SYNCED_KEYS.includes(key));
    if ((options.sync ?? true) && syncedChanges.length > 0) {
        settingsSync?.(
            Object.fromEntries(
                syncedChanges.map((key) => [
                    key,
                    newState[key as keyof UiState]
                ])
            )
        );
    }
    subscribers.forEach((callback) => callback());
    return newState;
}

/** The current state, re-rendering the caller whenever it changes. */
export function useGetUiState(): UiState {
    return useSyncExternalStore(subscribeToUiState, getUiState);
}

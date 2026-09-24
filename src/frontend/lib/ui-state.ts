import { useSyncExternalStore } from "react";
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { UtilityTab } from "@backend/features/settings/app-tab";
import { Vendor } from "@backend/features/library/vendors";
import { DEFAULT_THEME, Theme } from "@backend/features/settings/settings";
import { OnshapeLaunchType } from "./onshape-launch";

/** Bumped when a change to the schema makes stored state unusable. */
const LATEST_VERSION = 4;

const VendorType = z.enum(Object.values(Vendor));
const AccessLevelType = z.enum(Object.values(AccessLevel));
const ThemeType = z.enum(Object.values(Theme));
const LibraryIdType = z.enum(Object.values(LibraryId));
const AppTabType = z.union([LibraryIdType, z.enum(Object.values(UtilityTab))]);

/** Also saved to the user's row, so a new browser starts where they left off. */
const SyncedStateSchema = z.object({
    theme: ThemeType.default(DEFAULT_THEME),
    /** Null until one is picked, which the welcome asks for. */
    tabId: AppTabType.nullable().default(null),
    /** The group last opened in that tab; null for the tab itself. */
    groupId: z.string().nullable().default(null)
});

/** Kept until the browser's storage is cleared: preferences, and where to resume. */
const LocalStateSchema = z.object({
    isFavoritesOpen: z.boolean().default(false),
    isLibraryOpen: z.boolean().default(true),
    /** Per library; a library with no entry has every vendor active. */
    vendorFilters: z
        .partialRecord(LibraryIdType, z.array(VendorType))
        .default({}),
    searchQuery: z.string().default(""),
    fasten: z.boolean().default(true),
    /** The access level to view the app as; absent means the granted default. */
    accessLevel: AccessLevelType.optional(),
    /** So a relaunch can reopen the insert menu. */
    openInsertableId: z.string().optional(),
    /** Overrides as `id=value;id=value`; absent for the defaults. */
    openConfiguration: z.string().optional(),
    openFavoriteId: z.string().optional()
});

/** This tab only. */
const SessionStateSchema = z.object({
    /** Set on leaving for Onshape, so the returning tab can confirm the sign-in. */
    justSignedIn: z.boolean().default(false),
    // Per tab: each browser tab is a different document.
    ...OnshapeLaunchType.shape
});

type LocalState = z.infer<typeof LocalStateSchema>;
type SessionState = z.infer<typeof SessionStateSchema>;
type SyncedState = z.infer<typeof SyncedStateSchema>;
type UiState = LocalState & SessionState & SyncedState;

interface StateArea {
    storageKey: string;
    schema: z.ZodObject;
    /** Read at call time: touching a blocked store is what throws. */
    getStorage: () => Storage;
}

const LOCAL_AREA: StateArea = {
    storageKey: "uiState",
    // Synced fields share the local blob; splitting them out would reset
    // preferences already stored.
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

/** Installed at startup, keeping the endpoint and its sign-in out of here. */
export function setSettingsSync(sync: SettingsSync): void {
    settingsSync = sync;
}

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();

/** The state this session is working from; the stores are written behind it. */
let currentState: UiState | undefined;

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

/** Falls back to defaults for anything old or malformed: losing a preference beats failing to start. */
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
        // The one object-valued field.
        return typedKey === "vendorFilters"
            ? JSON.stringify(current[typedKey]) !==
                  JSON.stringify(partialState[typedKey])
            : current[typedKey] !== partialState[typedKey];
    });
}

interface UpdateOptions {
    /**
     * False for a value the row already holds, like the theme entry seeds.
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

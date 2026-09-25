/**
 * The frontend's one store of what the app shows and remembers. Components read
 * it through `useUiState` with a selector, so each re-renders only for its own
 * fields.
 */
import { create } from "zustand";
import * as z from "zod";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { Vendor } from "@backend/features/library/vendors";
import { AppTabType } from "./app-tab";
import { OnshapeLaunchType } from "./onshape-launch";

export enum Theme {
    DARK = "dark",
    LIGHT = "light"
}

/**
 * Kept until the browser's storage is cleared. Each field falls back on its
 * own, so one stale value never costs the rest.
 */
const StoredStateSchema = z.object({
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

/** This browser tab only: each one is a different Onshape document. */
const TabStateSchema = z.object({
    /** Set on leaving for Onshape, so the returning tab can confirm the sign-in. */
    justSignedIn: z.boolean().catch(false),
    ...OnshapeLaunchType.shape
});

type UiState = z.infer<typeof StoredStateSchema> &
    z.infer<typeof TabStateSchema>;

interface Persisted {
    key: string;
    schema: z.ZodObject;
    /** Read at call time: touching a blocked store is what throws. */
    storage: () => Storage;
}

const PERSISTED: Persisted[] = [
    {
        key: "uiState",
        schema: StoredStateSchema,
        storage: () => window.localStorage
    },
    {
        key: "uiSessionState",
        schema: TabStateSchema,
        storage: () => window.sessionStorage
    }
];

/** Blocked or partitioned storage must not break the app, only its memory. */
function read(persisted: Persisted): Record<string, unknown> {
    let stored: unknown = {};
    try {
        stored = JSON.parse(
            persisted.storage().getItem(persisted.key) ?? "{}"
        ) as unknown;
    } catch {
        // Unreadable: every field takes its default.
    }
    const parsed = persisted.schema.safeParse(stored);
    return parsed.success ? parsed.data : persisted.schema.parse({});
}

function write(persisted: Persisted, state: UiState): void {
    const fields = Object.fromEntries(
        Object.keys(persisted.schema.shape).map((key) => [
            key,
            state[key as keyof UiState]
        ])
    );
    try {
        persisted.storage().setItem(persisted.key, JSON.stringify(fields));
    } catch {
        // The store in memory still serves this session.
    }
}

export const useUiState = create<UiState>()(
    () =>
        Object.assign(
            {},
            ...PERSISTED.map((persisted) => read(persisted))
        ) as UiState
);

useUiState.subscribe((state, previous) => {
    for (const persisted of PERSISTED) {
        const changed = Object.keys(persisted.schema.shape).some(
            (key) =>
                state[key as keyof UiState] !== previous[key as keyof UiState]
        );
        if (changed) {
            write(persisted, state);
        }
    }
});

export function getUiState(): UiState {
    return useUiState.getState();
}

export function updateUiState(update: Partial<UiState>): void {
    useUiState.setState(update);
}

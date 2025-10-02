import { useSyncExternalStore } from "react";
import * as z from "zod";
import { Vendor } from "./models";

const VendorType = z.enum(Object.values(Vendor));

const UiStateSchema = z.object({
    isFavoritesOpen: z.boolean().default(false),
    isLibraryOpen: z.boolean().default(true),
    searchQuery: z.string().optional(),
    vendorFilters: z.array(VendorType).optional(),
    openDocumentId: z.string().optional()
});

type UiState = z.infer<typeof UiStateSchema>;

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();

let uiStateCache: UiState | null = null;

export function setUiState(uiState: UiState) {
    const parsed = UiStateSchema.parse(uiState);

    // Only update if changed
    if (
        uiStateCache === null ||
        JSON.stringify(parsed) !== JSON.stringify(uiStateCache)
    ) {
        uiStateCache = parsed;
        window.localStorage.setItem("uiState", JSON.stringify(parsed));
        subscribers.forEach((callback) => callback());
    }
}

export function getUiState(): UiState {
    if (uiStateCache) return uiStateCache;

    const raw = window.localStorage.getItem("uiState");
    if (!raw) {
        uiStateCache = UiStateSchema.parse({});
        return uiStateCache;
    }

    uiStateCache = UiStateSchema.parse(
        // Convert null to undefined for optional fields
        JSON.parse(raw, (_key, value) => value ?? undefined)
    );
    return uiStateCache;
}

function subscribeToUiState(callback: Subscriber) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

export function updateUiState(partialState: Partial<UiState>): UiState {
    const newState = { ...getUiState(), ...partialState };
    setUiState(newState);
    return newState;
}

export function useUiState(): [UiState, (uiState: Partial<UiState>) => void] {
    // Create a react version of the state to trigger re-renders
    const reactUiState = useSyncExternalStore(subscribeToUiState, getUiState);

    return [reactUiState, updateUiState];
}

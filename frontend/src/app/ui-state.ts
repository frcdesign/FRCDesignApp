import { useCallback, useState } from "react";
import * as z from "zod";
import { Vendor } from "../api/models";

const VendorType = z.enum(Object.values(Vendor));

const UiStateSchema = z.object({
    isFavoritesOpen: z.boolean().default(false),
    isLibraryOpen: z.boolean().default(true),
    vendorFilters: z.array(VendorType).optional(),
    openDocumentId: z.string().optional()
});

type UiState = z.infer<typeof UiStateSchema>;

export function setUiState(uiState: UiState) {
    window.localStorage.setItem("uiState", JSON.stringify(uiState));
}

export function getUiState(): UiState {
    const uiState = window.localStorage.getItem("uiState");
    if (uiState === null) {
        return UiStateSchema.parse({});
    }
    return UiStateSchema.parse(
        JSON.parse(uiState, (_key, value) => {
            // Convert null to undefined for optional fields
            if (value === null) {
                return undefined;
            }
            return value;
        })
    );
}

export function updateUiState(
    currentState: UiState,
    partialState: Partial<UiState>
): UiState {
    const newState = { ...currentState, ...partialState };
    setUiState(newState);
    return newState;
}

export function useUiState(): [UiState, (uiState: Partial<UiState>) => void] {
    // Create a react version of the state to trigger re-renders
    const [reactUiState, setReactUiState] = useState(getUiState());

    const handleSetUiState = useCallback(
        (newState: Partial<UiState>) => {
            setReactUiState(updateUiState(reactUiState, newState));
        },
        [reactUiState]
    );
    return [reactUiState, handleSetUiState];
}

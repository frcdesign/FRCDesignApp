import type { Vendor } from "@backend/features/library/vendors";
import type { LibraryId } from "@backend/features/library/library-id";
import { getUiState, updateUiState, useUiState } from "../../lib/ui-state";
import { useLibraryId } from "../../lib/library";

/** The current library's active filters; `undefined` means every vendor. */
export function useVendorFilters(): Vendor[] | undefined {
    const libraryId = useLibraryId();
    return useUiState((state) => state.vendorFilters[libraryId]);
}

/** An empty list is no filter, so it's stored as absent. */
export function setVendorFilters(
    libraryId: LibraryId,
    vendors: Vendor[]
): void {
    // Read at call time, so two changes in a tick don't drop each other.
    const vendorFilters = { ...getUiState().vendorFilters };
    if (vendors.length > 0) {
        vendorFilters[libraryId] = vendors;
    } else {
        delete vendorFilters[libraryId];
    }
    updateUiState({ vendorFilters });
}

/** Drops the current library's filters, leaving the other libraries' alone. */
export function useClearVendorFilters(): () => void {
    const libraryId = useLibraryId();
    return () => setVendorFilters(libraryId, []);
}

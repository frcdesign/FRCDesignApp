import { InsertableOut } from "../../../backend/features/library/dto";
import { Vendor } from "../../../backend/features/library/vendors";
import { FilterResult } from "./search";

export interface FilterArgs {
    /**
     * A list of one or more vendors to keep.
     */
    vendors?: Vendor[];
    /**
     * @default false
     */
    isVisible?: boolean;
}

interface VendorFilterResult extends FilterResult {
    byGroup: 0;
}

/**
 * A list of insertables which have (possibly) been filtered down.
 */
export interface FilteredInsertables {
    insertables: InsertableOut[];
    filtered: VendorFilterResult;
}

/**
 * Returns an ordered list of insertables in a document and tracks how many were filtered by vendors.
 * Does not include handling for being in a document since this should only be used when search is not active.
 */
export function filterInsertables(
    insertables: InsertableOut[],
    args: FilterArgs
): FilteredInsertables {
    let filtered = [...insertables];

    // Filter by visibility
    if (args.isVisible) {
        filtered = filtered.filter((ins) => ins.isVisible);
    }

    // Filter by vendors and track how many were removed
    let filteredByVendor = 0;
    if (args.vendors && args.vendors.length > 0) {
        const vendorSet = new Set(args.vendors);
        const beforeCount = filtered.length;
        filtered = filtered.filter((ins) =>
            ins?.vendors.some((vendor) => vendorSet.has(vendor))
        );
        filteredByVendor = beforeCount - filtered.length;
    }

    return {
        insertables: filtered,
        filtered: { byGroup: 0, byVendor: filteredByVendor }
    };
}

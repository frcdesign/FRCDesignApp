import { InsertableOut } from "@backend/features/library/contract";
import { Vendor } from "@backend/features/library/vendors";
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

/** Ordered insertables plus the vendor-filtered count. Browsing only: an
 * active search filters through `doSearch` instead. */
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

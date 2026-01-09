import { ElementObj, Vendor } from "../api/models";
import { FilterResult } from "./search";

export enum SortOrder {
    DEFAULT = "default",
    ASCENDING = "asc",
    DESCENDING = "desc"
}

export interface FilterArgs {
    /**
     * An order to sort in.
     * @default SortOrder.DEFAULT
     */
    sortOrder?: SortOrder;
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
    byDocument: 0;
}

/**
 * A list of elements which have (possibly) been filtered down.
 */
export interface FilteredElements {
    elements: ElementObj[];
    filtered: VendorFilterResult;
}

/**
 * Returns an ordered list of elements in a document and tracks how many were filtered by vendors.
 * Does not include handling for being in a document since this should only be used when search is not active.
 */
export function filterElements(
    elements: ElementObj[],
    args: FilterArgs
): FilteredElements {
    let filteredElements = [...elements];

    // Filter by visibility
    if (args.isVisible) {
        filteredElements = filteredElements.filter(
            (element) => element.isVisible
        );
    }

    // Filter by vendors and track how many were removed
    let filteredByVendor = 0;
    if (args.vendors && args.vendors.length > 0) {
        const vendorSet = new Set(args.vendors);
        const beforeCount = filteredElements.length;
        filteredElements = filteredElements.filter(
            (element) =>
                element.vendors &&
                element.vendors.some((vendor) => vendorSet.has(vendor))
        );
        filteredByVendor = beforeCount - filteredElements.length;
    }

    // Sorting
    if (args.sortOrder && args.sortOrder !== SortOrder.DEFAULT) {
        filteredElements.sort((a, b) => {
            const cmp = a.name.localeCompare(b.name);
            return args.sortOrder === SortOrder.ASCENDING ? cmp : -cmp;
        });
    }

    return {
        elements: filteredElements,
        filtered: { byDocument: 0, byVendor: filteredByVendor }
    };
}

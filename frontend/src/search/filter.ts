import { ElementObj, Vendor } from "../api/models";

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

export interface FilterResult {
    elements: ElementObj[];
    /**
     * The number of entities that were filtered out by the vendor filter.
     */
    filteredByVendors: number;
}

/**
 * Returns an ordered list of elements in a document and tracks how many were filtered by vendors.
 */
export function filterElements(
    elements: ElementObj[],
    args: FilterArgs
): FilterResult {
    let filtered = [...elements];

    // Filter by visibility
    if (args.isVisible) {
        filtered = filtered.filter((element) => element.isVisible);
    }

    // Filter by vendors and track how many were removed
    let filteredByVendors = 0;
    if (args.vendors && args.vendors.length > 0) {
        const vendorSet = new Set(args.vendors);
        const beforeCount = filtered.length;
        filtered = filtered.filter(
            (element) => element.vendor && vendorSet.has(element.vendor)
        );
        filteredByVendors = beforeCount - filtered.length;
    }

    // Sorting
    if (args.sortOrder && args.sortOrder !== SortOrder.DEFAULT) {
        filtered.sort((a, b) => {
            const cmp = a.name.localeCompare(b.name);
            return args.sortOrder === SortOrder.ASCENDING ? cmp : -cmp;
        });
    }

    return {
        elements: filtered,
        filteredByVendors
    };
}

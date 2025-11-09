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
     * The number of entities that were filtered out by user-controllable filters.
     */
    filtered: number;
}

/**
 * Returns an ordered list of elements in a document and tracks how many were filtered by vendors.
 */
export function filterElements(
    elements: ElementObj[],
    args: FilterArgs
): FilterResult {
    let filteredElements = [...elements];

    // Filter by visibility
    if (args.isVisible) {
        filteredElements = filteredElements.filter(
            (element) => element.isVisible
        );
    }

    // Filter by vendors and track how many were removed
    let filtered = 0;
    if (args.vendors && args.vendors.length > 0) {
        const vendorSet = new Set(args.vendors);
        const beforeCount = filteredElements.length;
        filteredElements = filteredElements.filter(
            (element) =>
                element.vendors &&
                element.vendors.some((vendor) => vendorSet.has(vendor))
        );
        filtered = beforeCount - filteredElements.length;
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
        filtered
    };
}

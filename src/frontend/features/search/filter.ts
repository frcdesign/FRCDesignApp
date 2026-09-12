import { InsertableOut, Insertables } from "@backend/features/library/contract";
import { Vendor } from "@backend/features/library/vendors";
import {
    doSearch,
    type FilterResult,
    type SearchArgs,
    type SearchHit
} from "./search";

interface FilterArgs {
    /** One or more vendors to keep; every vendor when absent. */
    vendors?: Vendor[];
    /** Drops what is hidden, which only an editor is shown. */
    visibleOnly?: boolean;
}

/**
 * Insertables narrowed for display, plus what the narrowing cost. Searching and
 * plain filtering both produce one, so a list renders the same either way.
 */
export interface FilteredInsertables {
    insertables: InsertableOut[];
    filtered: FilterResult;
    /** Where the query matched each row, by id; empty when nothing was searched. */
    hits: Record<string, SearchHit>;
}

/** Ordered insertables plus the vendor-filtered count. Browsing only: an
 * active search goes through `searchInsertables` instead. */
export function filterInsertables(
    insertables: InsertableOut[],
    args: FilterArgs
): FilteredInsertables {
    let filtered = args.visibleOnly
        ? insertables.filter((insertable) => insertable.isVisible)
        : insertables;

    let filteredByVendor = 0;
    if (args.vendors && args.vendors.length > 0) {
        const vendorSet = new Set(args.vendors);
        const beforeCount = filtered.length;
        filtered = filtered.filter((insertable) =>
            insertable.vendors.some((vendor) => vendorSet.has(vendor))
        );
        filteredByVendor = beforeCount - filtered.length;
    }

    return {
        insertables: filtered,
        filtered: { byGroup: 0, byVendor: filteredByVendor },
        hits: {}
    };
}

interface SearchInsertablesArgs extends SearchArgs {
    query: string;
    /** The library's insertables, which hits are resolved against. */
    insertables: Insertables;
}

/** The search's hits as insertables, in the order it ranked them. */
export function searchInsertables(
    args: SearchInsertablesArgs
): FilteredInsertables {
    const { hits, filtered } = doSearch(args);

    const insertables: InsertableOut[] = [];
    const hitsById: Record<string, SearchHit> = {};
    for (const hit of hits) {
        const insertable = args.insertables[hit.id];
        // The index is built from the library, so a miss means it moved on.
        if (!insertable) {
            continue;
        }
        insertables.push(insertable);
        hitsById[hit.id] = hit;
    }

    return { insertables, filtered, hits: hitsById };
}

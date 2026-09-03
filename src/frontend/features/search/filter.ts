import MiniSearch from "minisearch";
import { InsertableOut, Insertables } from "@backend/features/library/contract";
import { SearchDocument } from "@backend/features/search/search-index";
import { Vendor } from "@backend/features/library/vendors";
import { doSearch, FilterResult, SearchFilters, SearchHit } from "./search";

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
    let filtered = [...insertables];

    if (args.isVisible) {
        filtered = filtered.filter((ins) => ins.isVisible);
    }

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
        filtered: { byGroup: 0, byVendor: filteredByVendor },
        hits: {}
    };
}

export interface SearchArgs {
    searchDb: MiniSearch<SearchDocument>;
    /** The library's insertables, which hits are resolved against. */
    insertables: Insertables;
    query: string;
    filters?: SearchFilters;
    /** Required by a `isFavorite` filter, which matches against it. */
    favoritedInsertableIds?: Set<string>;
    /** @default false */
    showHidden?: boolean;
}

/** The search's hits as insertables, in the order it ranked them. */
export function searchInsertables(args: SearchArgs): FilteredInsertables {
    const { hits, filtered } = doSearch(
        args.searchDb,
        args.query,
        args.filters,
        args.favoritedInsertableIds,
        args.showHidden
    );

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

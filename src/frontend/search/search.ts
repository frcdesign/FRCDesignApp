import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";
import { Vendor } from "../../shared/types";
import { SearchDocument, PartNumberMap } from "../../shared/search";
import { ParameterValues } from "../../shared/configuration-models";

/**
 * A user facing name to use for elements currently being filtered/searched on.
 */
export type ObjectLabel = "element" | "favorite" | "search result";

/**
 * Returns the plural form of an object label.
 */
export function plural(objectLabel: ObjectLabel): string {
    return objectLabel + "s";
}

export interface SearchFilters {
    groupId?: string;
    vendors?: Vendor[];
    isFavorite?: boolean;
}

// Range is already defined by TypeScript
export interface Position {
    start: number;
    length: number;
}

export interface SearchHit {
    id: string;
    positions: Position[];
    /**
     * When the hit matched on a part number, the configuration that produces
     * that part number, used to pre-fill the insert menu.
     */
    configuration?: ParameterValues;
}

export interface FilterResult {
    /**
     * The number of items filtered out by vendor filters.
     */
    byVendor: number;
    /**
     * The number of items filtered out by being in a different group.
     * Does not include results that would have been filtered out by vendors.
     */
    byGroup: number;
}

export interface SearchResult {
    hits: SearchHit[];
    filtered: FilterResult;
}

export function doSearch(
    searchDb: MiniSearch<SearchDocument>,
    query?: string,
    filters?: SearchFilters,
    favoritedInsertableIds?: Set<string>,
    showHidden?: boolean
): SearchResult {
    const filtered: FilterResult = { byVendor: 0, byGroup: 0 };

    if (!query || query.trim() === "") {
        return { hits: [], filtered };
    }

    const miniSearchResults: MiniSearchResult[] = searchDb.search(query, {
        filter: (searchResult) => {
            if (!showHidden && !searchResult.isVisible) {
                return false;
            }

            if (filters?.isFavorite) {
                if (!favoritedInsertableIds?.has(searchResult.id)) {
                    return false;
                }
            }

            let filteredByGroup = false;
            let filteredByVendor = false;
            if (filters?.groupId && searchResult.groupId !== filters.groupId) {
                filteredByGroup = true;
            }

            if (
                filters?.vendors &&
                !filters.vendors.some((vendor) =>
                    searchResult.vendors.includes(vendor)
                )
            ) {
                filteredByVendor = true;
            }

            if (filteredByVendor && filteredByGroup) {
                // If something is filtered by vendors and groups, don't count it since neither button would show it on its own
                return false;
            } else if (filteredByGroup) {
                filtered.byGroup += 1;
                return false;
            } else if (filteredByVendor) {
                filtered.byVendor += 1;
                return false;
            }

            return true;
        }
    });

    // Add highlighting
    const hits: SearchHit[] = miniSearchResults
        .map((miniSearchResult) => {
            // Stored fields should be the same as SearchDocument
            const document = searchDb.getStoredFields(
                miniSearchResult.id
            ) as unknown as SearchDocument;
            const positions = generateHighlightPositions(
                miniSearchResult,
                document
            );

            return {
                id: document.id,
                positions,
                configuration: matchedConfiguration(
                    miniSearchResult,
                    document,
                    query
                )
            };
        })
        .slice(0, 50); // Limit to 50 results

    return { hits, filtered };
}

/**
 * If the result matched on the part-number field, returns the configuration
 * that produces the best-matching part number so the insert menu can launch it.
 */
function matchedConfiguration(
    result: MiniSearchResult,
    document: SearchDocument,
    query: string
): ParameterValues | undefined {
    const matchedPartNumber = Object.values(result.match).some((fields) =>
        fields.includes("partNumbers")
    );
    if (!matchedPartNumber) {
        return undefined;
    }
    return findPartNumberConfig(query, document.partNumberConfigs);
}

/**
 * Picks the configuration whose part number best matches the query, preferring
 * an exact match, then a prefix, then a substring. First-wins on ties; the map
 * is in enumeration order, so a tie resolves to the latest option (the first the
 * insertable declares) — see PartNumberMap.
 */
function findPartNumberConfig(
    query: string,
    partNumberConfigs: PartNumberMap
): ParameterValues | undefined {
    const keys = Object.keys(partNumberConfigs);
    const normalizedQuery = query.trim().toLowerCase();
    if (keys.length === 0 || normalizedQuery === "") {
        return undefined;
    }

    const match =
        keys.find((key) => key.toLowerCase() === normalizedQuery) ??
        keys.find((key) => key.toLowerCase().startsWith(normalizedQuery)) ??
        keys.find((key) => key.toLowerCase().includes(normalizedQuery));

    return match ? partNumberConfigs[match] : undefined;
}

/**
 * Generate highlight positions for matched terms in the document.
 * Based on approach from https://github.com/lucaong/minisearch/issues/37
 */
function generateHighlightPositions(
    result: MiniSearchResult,
    document: SearchDocument
): Position[] {
    // Terms is an array of values in name (or spacedName) which matched
    // e.g., if search is "mot w", then terms could be ["motor", "WCP"]

    const name = document.name.toLowerCase();

    const positions: Position[] = [];

    for (const [term, matchedFields] of Object.entries(result.match)) {
        // Only include terms that matched something in the name field
        if (!matchedFields.includes("name")) {
            continue;
        }
        const matchedLocations = name.matchAll(new RegExp(`(${term})`, "gi"));
        for (const match of matchedLocations) {
            positions.push({
                start: match.index,
                length: term.length
            });
        }
    }

    return positions;
}

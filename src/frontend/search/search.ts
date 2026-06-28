import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";
import { Favorite, InsertableOut } from "../../shared/api-models";
import { Vendor } from "../../shared/types";
import { SearchDocument } from "../../shared/search";

// Re-export the shared index definitions so existing frontend imports keep working.
export type { SearchDocument } from "../../shared/search";
export {
    SEARCH_OPTIONS,
    buildSearchDb,
    processTerm,
    tokenize
} from "../../shared/search";

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
                positions
            };
        })
        .slice(0, 50); // Limit to 50 results

    return { hits, filtered };
}
export function doFavoriteSearch(
    searchDb: MiniSearch<SearchDocument>,
    query?: string,
    filters?: SearchFilters,
    favoritedInsertableIds?: Set<string>,
    showHidden?: boolean,
    favorites?: Record<string, Favorite>,
    insertables?: Record<string, InsertableOut>
): SearchResult {
    const filtered: FilterResult = { byVendor: 0, byGroup: 0 };

    if (!query || query.trim() === "") {
        return { hits: [], filtered };
    }

    const tokenizedQuery = query.trim().toLowerCase();

    const baseSearchResult = doSearch(
        searchDb,
        query,
        filters,
        favoritedInsertableIds,
        showHidden
    );

    const hitsById = new Map<string, SearchHit>(
        baseSearchResult.hits.map((hit) => [hit.id, hit])
    );

    if (favorites && insertables) {
        for (const favorite of Object.values(favorites)) {
            const insertable = insertables[favorite.insertableId];
            if (!insertable) {
                continue;
            }

            if (!showHidden && !insertable.isVisible) {
                continue;
            }

            if (
                favoritedInsertableIds &&
                !favoritedInsertableIds.has(insertable.id)
            ) {
                continue;
            }

            let filteredByGroup = false;
            let filteredByVendor = false;
            if (filters?.groupId && insertable.groupId !== filters.groupId) {
                filteredByGroup = true;
            }

            if (
                filters?.vendors &&
                !filters.vendors.some((vendor) =>
                    insertable.vendors.includes(vendor)
                )
            ) {
                filteredByVendor = true;
            }

            if (filteredByVendor && filteredByGroup) {
                continue;
            } else if (filteredByGroup) {
                filtered.byGroup += 1;
                continue;
            } else if (filteredByVendor) {
                filtered.byVendor += 1;
                continue;
            }

            const displayName = favorite.favoriteName ?? insertable.name;
            if (!matchesQuery(displayName, tokenizedQuery)) {
                continue;
            }

            if (!hitsById.has(insertable.id)) {
                hitsById.set(insertable.id, {
                    id: insertable.id,
                    positions: generateHighlightPositionsFromText(
                        displayName,
                        tokenizedQuery
                    )
                });
            }
        }
    }

    return {
        hits: Array.from(hitsById.values()).slice(0, 50),
        filtered: {
            byVendor: filtered.byVendor + baseSearchResult.filtered.byVendor,
            byGroup: filtered.byGroup + baseSearchResult.filtered.byGroup
        }
    };
}

function matchesQuery(text: string, query: string): boolean {
    return text.toLowerCase().includes(query);
}

function generateHighlightPositionsFromText(
    text: string,
    query: string
): Position[] {
    if (!query) {
        return [];
    }

    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    const start = normalizedText.indexOf(normalizedQuery);
    if (start === -1) {
        return [];
    }

    return [{ start, length: normalizedQuery.length }];
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

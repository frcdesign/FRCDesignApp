import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";
import { Vendor } from "../../../backend/features/library/vendors";
import {
    SearchDocument,
    normalizeForMatch
} from "../../../backend/features/search/search-index";
import {
    ParameterValues,
    SearchRecord
} from "../../../backend/features/configurations/models";

/**
 * A user facing name to use for elements currently being filtered/searched on.
 */
export type ObjectLabel = "element" | "favorite" | "search result";

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
     * The best-matching configuration for this hit, used to pre-fill the insert
     * menu — its part number, name, and the parameter values that produce it.
     */
    configuration?: ParameterValues;
    partNumber?: string;
    partName?: string;
    /** Where the query matched inside `partNumber` / `partName`, for underlining. */
    partNumberPositions?: Position[];
    partNamePositions?: Position[];
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
            const record = matchedRecord(miniSearchResult, document, query);
            const partNumber = record?.partNumber ?? undefined;
            const partName = record?.name ?? undefined;
            return {
                id: document.id,
                positions: generateHighlightPositions(
                    miniSearchResult,
                    document.name,
                    "name"
                ),
                configuration: record?.configuration,
                partNumber,
                partName,
                partNumberPositions: partNumber
                    ? generateHighlightPositions(
                          miniSearchResult,
                          partNumber,
                          "partNumbers"
                      )
                    : undefined,
                partNamePositions: partName
                    ? generateHighlightPositions(
                          miniSearchResult,
                          partName,
                          "partNames"
                      )
                    : undefined
            };
        })
        .slice(0, 50); // Limit to 50 results

    return { hits, filtered };
}

/**
 * The single best record for a hit: matched by part number, else by name, else
 * the default — so every row can show a part number and name.
 */
function matchedRecord(
    result: MiniSearchResult,
    document: SearchDocument,
    query: string
): SearchRecord | undefined {
    const matchedFields = Object.values(result.match).flat();
    const byNumber = matchedFields.includes("partNumbers")
        ? findBestRecord(query, document.records, (r) => r.partNumber)
        : undefined;
    const byName = matchedFields.includes("partNames")
        ? findBestRecord(query, document.records, (r) => r.name)
        : undefined;
    // A multi-term query can match the field without any one record matching the
    // whole query, so fall back rather than leaving the row with no record.
    return byNumber ?? byName ?? document.records[0];
}

/**
 * Prefers an exact match, then a prefix, then a substring. Ties go first-wins,
 * which in enumeration order is the latest option.
 */
function findBestRecord(
    query: string,
    records: SearchRecord[],
    selector: (record: SearchRecord) => string | null
): SearchRecord | undefined {
    const normalizedQuery = normalizeForMatch(query.trim());
    if (records.length === 0 || normalizedQuery === "") {
        return undefined;
    }

    // Canonicalize the same way the index did, so a fraction/decimal query lines
    // up with the stored original (e.g. `.5` matches a `"1/2 Bearing"` name).
    const value = (record: SearchRecord) =>
        normalizeForMatch(selector(record) ?? "");

    return (
        records.find((r) => value(r) === normalizedQuery) ??
        records.find((r) => value(r).startsWith(normalizedQuery)) ??
        records.find((r) => value(r).includes(normalizedQuery))
    );
}

/** Escapes a term so it matches literally (terms can carry `.`, `(`, and friends). */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Underlines the longest query term the match starts with, so a prefix search
 * underlines only what was typed. Falls back to the whole term.
 */
function matchedPrefixLength(term: string, queryTerms: string[]): number {
    let length = 0;
    for (const queryTerm of queryTerms) {
        if (term.startsWith(queryTerm) && queryTerm.length > length) {
            length = queryTerm.length;
        }
    }
    return length || term.length;
}

/**
 * `match` is keyed by matched document terms and `queryTerms` by what was typed.
 * Based on https://github.com/lucaong/minisearch/issues/37
 */
function generateHighlightPositions(
    result: MiniSearchResult,
    text: string,
    field: string
): Position[] {
    const haystack = text.toLowerCase();
    const positions: Position[] = [];

    for (const [term, matchedFields] of Object.entries(result.match)) {
        if (!matchedFields.includes(field)) {
            continue;
        }
        const length = matchedPrefixLength(term, result.queryTerms);
        const matchedLocations = haystack.matchAll(
            new RegExp(escapeRegExp(term), "g")
        );
        for (const match of matchedLocations) {
            positions.push({ start: match.index, length });
        }
    }

    return positions;
}

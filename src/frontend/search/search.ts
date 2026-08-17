import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";
import { Vendor } from "../../shared/types";
import { SearchDocument, normalizeForMatch } from "../../shared/search";
import {
    ParameterValues,
    SearchRecord
} from "../../shared/configuration-models";

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
     * The best-matching configuration for this hit, used to pre-fill the insert
     * menu — its part number, name, and the parameter values that produce it.
     */
    configuration?: ParameterValues;
    partNumber?: string;
    partName?: string;
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

            const record = matchedRecord(miniSearchResult, document, query);
            return {
                id: document.id,
                positions,
                configuration: record?.configuration,
                partNumber: record?.partNumber ?? undefined,
                partName: record?.name ?? undefined
            };
        })
        .slice(0, 50); // Limit to 50 results

    return { hits, filtered };
}

/**
 * Picks the single best-matching record for a hit: the one whose part number
 * matched (when the hit matched the part-number field), else whose name matched
 * (part-name field), else the default record (`records[0]`) for a pure title
 * match — so every result row can show a part number + name.
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
 * Picks the record whose selected value (part number or name) best matches the
 * query, preferring an exact match, then a prefix, then a substring. First-wins
 * on ties; records are in enumeration order, so a tie resolves to the latest
 * option (the first the insertable declares).
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
 * How much of a matched term to underline: the longest query term it starts
 * with — what the user actually typed — so a prefix search underlines only the
 * typed prefix. Falls back to the whole term if none is a prefix.
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
 * Generate highlight positions for matched terms in the document.
 * Based on approach from https://github.com/lucaong/minisearch/issues/37
 */
function generateHighlightPositions(
    result: MiniSearchResult,
    document: SearchDocument
): Position[] {
    // `match` is keyed by the document terms that matched, `queryTerms` by what
    // was typed: searching "mot" matches the term "motor", and we underline just
    // its "mot". Overlapping ranges are merged when they're applied.

    const name = document.name.toLowerCase();

    const positions: Position[] = [];

    for (const [term, matchedFields] of Object.entries(result.match)) {
        // Only include terms that matched something in the name field
        if (!matchedFields.includes("name")) {
            continue;
        }
        const length = matchedPrefixLength(term, result.queryTerms);
        const matchedLocations = name.matchAll(
            new RegExp(escapeRegExp(term), "g")
        );
        for (const match of matchedLocations) {
            positions.push({
                start: match.index,
                length
            });
        }
    }

    return positions;
}

import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";
import { Vendor } from "@backend/features/library/vendors";
import {
    SearchDocument,
    normalizeForMatch,
    tokenizeName,
    tokenizePartNumber
} from "@backend/features/search/search-index";
import { SearchRecord } from "@backend/features/configurations/models";

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
     * The best-matching record for this hit, used to pre-fill the insert menu —
     * its part number, name, and the canonical selection that produces it.
     */
    canonicalConfiguration?: string;
    partNumber?: string;
    partName?: string;
    /** The vendor's page for the part number, when one can be derived. */
    url?: string;
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
                canonicalConfiguration: record?.canonicalConfiguration,
                partNumber,
                partName,
                url: record?.url,
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
 * The best record by part number or name, whichever the query describes better,
 * else the default — so a row shows one even when only the title matched.
 */
function matchedRecord(
    result: MiniSearchResult,
    document: SearchDocument,
    query: string
): SearchRecord | undefined {
    const matchedFields = Object.values(result.match).flat();
    const byNumber = matchedFields.includes("partNumbers")
        ? findBestRecord(query, document.records, (r) => r.partNumber, LITERAL)
        : undefined;
    const byName = matchedFields.includes("partNames")
        ? findBestRecord(query, document.records, (r) => r.name, DESCRIPTIVE)
        : undefined;

    const best = [byNumber, byName]
        .filter((match) => match !== undefined)
        // Part number first, so it wins a tie: it is the more specific field.
        .sort((a, b) => b.score - a.score)[0];
    return best?.record ?? document.records[0];
}

interface RecordMatch {
    record: SearchRecord;
    score: number;
}

/**
 * How a field's text is read for scoring: a part number is compared as typed,
 * a name around the decimals its sizes are indexed as.
 */
interface FieldReader {
    normalize: (text: string) => string;
    terms: (text: string) => string[];
}

/** A part number identifies: `217-2600` is a code, not a number. */
const LITERAL: FieldReader = {
    normalize: (text) => text.trim().toLowerCase(),
    terms: tokenizePartNumber
};

/** A name describes, so `1/2`, `.5` and `0.5` are one size. */
const DESCRIPTIVE: FieldReader = {
    normalize: normalizeForMatch,
    terms: (text) => tokenizeName(text).map((term) => term.toLowerCase())
};

/**
 * How well one term is answered: a term matched whole beats one matched as a
 * prefix, which every longer number satisfies too — `1` names the size `1"`,
 * but only starts `16`.
 */
function termScore(valueTerms: string[], queryTerm: string): number {
    // A unit is not part of the number's spelling, so `1` still names `1"`.
    if (
        valueTerms.includes(queryTerm) ||
        valueTerms.includes(queryTerm + '"')
    ) {
        return 2;
    }
    return valueTerms.some((valueTerm) => valueTerm.startsWith(queryTerm))
        ? 1
        : 0;
}

/** How much of the query the value covers, term by term. */
function coveredTerms(
    value: string,
    queryTerms: string[],
    field: FieldReader
): number {
    const valueTerms = field.terms(value);
    return queryTerms.reduce(
        (score, queryTerm) => score + termScore(valueTerms, queryTerm),
        0
    );
}

/**
 * How well a value answers the query: a whole-query match ranks above any
 * number of loose terms, so a part number typed out in full still wins.
 */
function matchScore(
    value: string,
    normalizedQuery: string,
    queryTerms: string[],
    field: FieldReader
): number {
    let whole = 0;
    if (value === normalizedQuery) {
        whole = 3;
    } else if (value.startsWith(normalizedQuery)) {
        whole = 2;
    } else if (value.includes(normalizedQuery)) {
        whole = 1;
    }
    // Outweighs full term coverage, which is worth 2 a term.
    return (
        whole * (2 * queryTerms.length + 1) +
        coveredTerms(value, queryTerms, field)
    );
}

/**
 * Scored by term rather than by the whole query, which "maxspline 24t" matches
 * no record as. Ties go first-wins: the latest option, in enumeration order.
 */
function findBestRecord(
    query: string,
    records: SearchRecord[],
    selector: (record: SearchRecord) => string | undefined,
    field: FieldReader
): RecordMatch | undefined {
    // Read the query the way the field was indexed, so a `.5` query lines up
    // with a stored "1/2 Bearing" and a typed part number with itself.
    const normalizedQuery = field.normalize(query.trim());
    if (records.length === 0 || normalizedQuery === "") {
        return undefined;
    }
    const queryTerms = field.terms(query);

    let best: RecordMatch | undefined;
    for (const record of records) {
        const value = field.normalize(selector(record) ?? "");
        if (!value) continue;
        const score = matchScore(value, normalizedQuery, queryTerms, field);
        if (score > (best?.score ?? 0)) {
            best = { record, score };
        }
    }
    return best;
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

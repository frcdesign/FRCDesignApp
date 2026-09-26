import MiniSearch, {
    type Query,
    type SearchResult as MiniSearchResult
} from "minisearch";
import { Vendor } from "@backend/features/library/vendors";
import { type Position } from "../../lib/highlight";
import {
    INSERTABLE_FIELDS,
    SearchDocument
} from "@backend/features/search/contract";
import { matchedRecord } from "@backend/features/search/records";
import {
    nameSpans,
    partNumberSpans,
    queryWords,
    type TermSpan
} from "@backend/features/search/tokenize";
import {
    NAME_FIELD,
    PART_NAME_FIELD,
    PART_NUMBER_FIELD
} from "@backend/features/search/fields";
import {
    type ConfigurationKey,
    type PartialSelection
} from "@backend/features/configurations/contract";

/** As many results as a list is worth scrolling. */
const MAX_HITS = 50;

export interface SearchFilters {
    groupId?: string;
    vendors?: Vendor[];
    isFavorite?: boolean;
}

export interface SearchHit {
    id: string;
    positions: Position[];
    /** The best-matching record's values, which pre-fill the insert menu. */
    values?: PartialSelection;
    /** Those values' key, for the row's thumbnail. */
    configurationKey?: ConfigurationKey;
    partNumber?: string;
    partName?: string;
    /** The vendor's page for the part number, when one can be derived. */
    url?: string;
    /** Where the query matched inside `partNumber` / `partName`, for underlining. */
    partNumberPositions?: Position[];
    partNamePositions?: Position[];
}

export interface FilterResult {
    byVendor: number;
    /** Excludes results already filtered out by vendor. */
    byGroup: number;
}

interface SearchResult {
    hits: SearchHit[];
    filtered: FilterResult;
}

export interface SearchArgs {
    searchDb: MiniSearch<SearchDocument>;
    query?: string;
    filters?: SearchFilters;
    /** Required by an `isFavorite` filter, which matches against it. */
    favoritedInsertableIds?: Set<string>;
    /** @default false */
    showHidden?: boolean;
    /**
     * Off for favorites, which name one configuration: other configurations'
     * fields would pull them up.
     * @default true
     */
    searchConfigurations?: boolean;
}

export function doSearch(args: SearchArgs): SearchResult {
    const {
        searchDb,
        query,
        filters,
        favoritedInsertableIds,
        showHidden,
        searchConfigurations = true
    } = args;
    const filtered: FilterResult = { byVendor: 0, byGroup: 0 };

    const words = queryWords(query ?? "");
    if (words.length === 0) {
        return { hits: [], filtered };
    }
    const queryTerms = words.flat();

    // Each word narrows: any reading of it will do, but every word must match.
    const expression: Query = {
        combineWith: "AND",
        queries: words.map((terms) => ({ combineWith: "OR", queries: terms }))
    };
    const miniSearchResults: MiniSearchResult[] = searchDb.search(expression, {
        fields: searchConfigurations ? undefined : INSERTABLE_FIELDS,
        filter: (result) => {
            // MiniSearch types stored fields as `any`.
            const searchResult = result as unknown as Omit<
                MiniSearchResult,
                "id"
            > &
                SearchDocument;
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

    const hits: SearchHit[] = miniSearchResults
        // Before mapping, since each hit costs a record match and highlighting.
        .slice(0, MAX_HITS)
        .map((miniSearchResult) => {
            const document = searchDb.getStoredFields(
                miniSearchResult.id
            ) as unknown as SearchDocument;
            const record = matchedRecord(
                query ?? "",
                document.records,
                Object.values(miniSearchResult.match).flat()
            );
            const partNumber = record?.partNumber;
            const partName = record?.name;
            const underline = (
                text: string,
                field: string,
                spans: (text: string) => TermSpan[]
            ) =>
                highlightPositions(
                    spans(text),
                    matchedTerms(miniSearchResult, field),
                    queryTerms
                );
            return {
                id: document.id,
                positions: underline(document.name, NAME_FIELD, nameSpans),
                values: record?.values,
                configurationKey: record?.configurationKey,
                partNumber,
                partName,
                url: record?.url,
                partNumberPositions: underline(
                    partNumber ?? "",
                    PART_NUMBER_FIELD,
                    partNumberSpans
                ),
                partNamePositions: underline(
                    partName ?? "",
                    PART_NAME_FIELD,
                    nameSpans
                )
            };
        });

    return { hits, filtered };
}

/** The index terms a result matched in one field. */
function matchedTerms(result: MiniSearchResult, field: string): Set<string> {
    return new Set(
        Object.entries(result.match)
            .filter(([, fields]) => fields.includes(field))
            .map(([term]) => term)
    );
}

/**
 * Each span whose term matched. A literal one is underlined only as far as
 * the query typed it; a size read into another spelling, as a whole.
 */
function highlightPositions(
    spans: TermSpan[],
    matched: Set<string>,
    queryTerms: string[]
): Position[] {
    return spans
        .filter((span) => matched.has(span.term))
        .map((span) => {
            const typed = span.literal
                ? Math.max(
                      0,
                      ...queryTerms
                          .filter((term) => span.term.startsWith(term))
                          .map((term) => term.length)
                  )
                : 0;
            return {
                start: span.start,
                length: typed || span.end - span.start
            };
        });
}

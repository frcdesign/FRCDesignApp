import MiniSearch, { SearchResult as MiniSearchResult } from "minisearch";
import { Vendor } from "@backend/features/library/vendors";
import { type Position } from "../../lib/highlight";
import {
    INSERTABLE_FIELDS,
    SearchDocument
} from "@backend/features/search/contract";
import { matchedRecord } from "@backend/features/search/records";
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

    if (!query || query.trim() === "") {
        return { hits: [], filtered };
    }

    const miniSearchResults: MiniSearchResult[] = searchDb.search(query, {
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
                query,
                document.records,
                Object.values(miniSearchResult.match).flat()
            );
            const partNumber = record?.partNumber;
            const partName = record?.name;
            return {
                id: document.id,
                positions: generateHighlightPositions(
                    miniSearchResult,
                    document.name,
                    "name"
                ),
                values: record?.values,
                configurationKey: record?.configurationKey,
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
        });

    return { hits, filtered };
}

/** Escapes a term so it matches literally (terms can carry `.`, `(`, and friends). */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The longest query term the match starts with, so a prefix search underlines only what was typed. */
function matchedPrefixLength(term: string, queryTerms: string[]): number {
    let length = 0;
    for (const queryTerm of queryTerms) {
        if (term.startsWith(queryTerm) && queryTerm.length > length) {
            length = queryTerm.length;
        }
    }
    return length || term.length;
}

/** Based on https://github.com/lucaong/minisearch/issues/37 */
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

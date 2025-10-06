import MiniSearch, { Options, SearchResult } from "minisearch";
import { Documents, Elements, Vendor } from "../api/models";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, CacheOptions, useCacheOptions } from "../api/api";

const deliminator = "^";

/**
 * Adds spaces to a given string so prefix matching is more efficient.
 */
export function processTerm(term: string): string[] {
    // Split between lowercase-to-uppercase (camelCase -> camel case)
    const camelSplit = term
        .replace(/([a-z])([A-Z])/g, `$1${deliminator}$2`)
        .split(deliminator);

    // Insert space between sequences like "ABCDef" (PascalCase or acronyms)
    const pascalSplit = term
        .replace(/([A-Z])([A-Z][a-z])/g, `$1${deliminator}$2`)
        .split(deliminator);

    const base = term.toLowerCase();

    const terms = [...camelSplit, ...pascalSplit, base].map((t) =>
        t.toLowerCase()
    );
    // Deduplicate
    return Array.from(new Set(terms));
}

export function tokenize(text: string): string[] {
    // Don't lowercase so we can use casing for term splitting
    // Remove -, (, ), ", ', #, &, and whitespace
    return text.split(/[-()"'#&\s^]+/).filter(Boolean);
}

export interface SearchDocument {
    id: string;
    documentId: string;
    isVisible: boolean;
    vendor: string;
    name: string;
    documentName: string;
}

const searchOptions: Options<SearchDocument> = {
    fields: ["name", "documentName"],
    storeFields: [
        "id",
        "documentId",
        "isVisible",
        "vendor",
        "name",
        "documentName"
    ],
    searchOptions: {
        boost: { documentName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize,
    processTerm
};

export function buildSearchDb(
    documents: Documents,
    elements: Elements
): MiniSearch<SearchDocument> {
    const searchDb = new MiniSearch<SearchDocument>(searchOptions);

    const searchDocuments: SearchDocument[] = Object.values(elements).map(
        (element) => {
            const parentDocument = documents[element.documentId];
            return {
                id: element.id,
                documentId: element.documentId,
                isVisible: element.isVisible,
                vendor: element.vendor || "",
                name: element.name,
                documentName: parentDocument.name
            };
        }
    );

    searchDb.addAll(searchDocuments);
    return searchDb;
}

export interface SearchFilters {
    documentId?: string;
    vendors?: Vendor[];
}

// Range is already defined by TypeScript
export interface Position {
    start: number;
    length: number;
}

export interface SearchHit {
    document: SearchDocument;
    positions: Position[];
}

// Don't use SearchResult since that's also defined by MiniSearch
export interface Result {
    hits: SearchHit[];
    /**
     * The number of items filtered out of the result by user controllable filters (e.g., vendor filters).
     */
    filtered: number;
}

export function doSearch(
    searchDb: MiniSearch<SearchDocument>,
    query?: string,
    filters?: SearchFilters
): Result {
    if (!query || query.trim() === "") {
        return { hits: [], filtered: 0 };
    }

    let filtered = 0;
    const results = searchDb.search(query, {
        filter: (document) => {
            if (!document.isVisible) {
                return false;
            } else if (
                filters?.documentId &&
                document.documentId !== filters.documentId
            ) {
                return false;
            }

            if (
                filters &&
                filters.vendors &&
                filters.vendors.length > 0 &&
                !filters.vendors.includes(document.vendor as Vendor)
            ) {
                filtered += 1;
                return false;
            }

            return true;
        }
    });

    // Add highlighting
    const hits: SearchHit[] = results
        .map((result) => {
            // Stored fields should be the same as SearchDocument
            const document = searchDb.getStoredFields(
                result.id
            ) as unknown as SearchDocument;
            const positions = generateHighlightPositions(result, document);

            return {
                id: result.id,
                document,
                positions
            };
        })
        .slice(0, 50); // Limit to 50 results

    return { hits, filtered };
}

/**
 * Generate highlight positions for matched terms in the document.
 * Based on approach from https://github.com/lucaong/minisearch/issues/37
 */
function generateHighlightPositions(
    result: SearchResult,
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

export function getSearchDbQuery(cacheOptions: CacheOptions) {
    return queryOptions<MiniSearch | undefined>({
        queryKey: ["search-db"],
        queryFn: async () =>
            apiGet("/search-db", { cacheOptions }).then((result) => {
                if (!result.searchDb) {
                    return undefined;
                }
                return MiniSearch.loadJSON(result.searchDb, searchOptions);
            })
    });
}

export function useSearchDbQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getSearchDbQuery(cacheOptions));
}

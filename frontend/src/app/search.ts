import MiniSearch, { Options } from "minisearch";
import { Documents, Elements, Vendor } from "../api/models";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet, CacheOptions, useCacheOptions } from "../api/api";

export interface SearchDocument {
    id: string;
    documentId: string;
    isVisible: boolean;
    vendor: string;
    name: string;
    spacedName: string;
    documentName: string;
}

const searchOptions: Options<SearchDocument> = {
    fields: ["name", "spacedName", "documentName"],
    storeFields: [
        "id",
        "documentId",
        "isVisible",
        "vendor",
        "name",
        "spacedName",
        "documentName"
    ],
    searchOptions: {
        boost: { documentName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize: (text: string) => {
        return text
            .toLowerCase()
            .split(/[-()#\s^]+/)
            .filter(Boolean);
    }
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
                spacedName: addSpaces(element.name),
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

export interface Position {
    start: number;
    length: number;
}

export interface SearchHit {
    id: string;
    document: SearchDocument;
    positions: SearchPositions;
}

export type SearchPositions = Record<string, Position[]>;

export interface SearchResult {
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
): SearchResult {
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
            const storedFields = searchDb.getStoredFields(result.id);
            const document = storedFields as unknown as SearchDocument;

            // Generate highlighting positions
            const positions = generateHighlightPositions(document, query);

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
    document: SearchDocument,
    query: string
): SearchPositions {
    const positions: SearchPositions = {
        name: [],
        spacedName: [],
        documentName: []
    };

    // Tokenize the query
    const queryTokens = query
        .toLowerCase()
        .split(/[-()#\s^]+/)
        .filter(Boolean);

    // For each field, find positions of matching tokens
    const fields: (keyof SearchDocument)[] = [
        "name",
        "spacedName",
        "documentName"
    ];

    for (const field of fields) {
        const fieldValue = document[field] as string;
        const lowerFieldValue = fieldValue.toLowerCase();

        for (const token of queryTokens) {
            let startIndex = 0;
            let index = lowerFieldValue.indexOf(token, startIndex);

            while (index !== -1) {
                // Check if this is a word boundary match
                const beforeChar = index > 0 ? lowerFieldValue[index - 1] : " ";
                const afterChar =
                    index + token.length < lowerFieldValue.length
                        ? lowerFieldValue[index + token.length]
                        : " ";

                // Match if at word boundary or after special chars
                if (
                    /[-()#\s^]/.test(beforeChar) ||
                    /[-()#\s^]/.test(afterChar) ||
                    index === 0
                ) {
                    positions[field].push({
                        start: index,
                        length: token.length
                    });
                }

                startIndex = index + 1;
                index = lowerFieldValue.indexOf(token, startIndex);
            }
        }
    }

    return positions;
}

export const DELIMINATOR = "^";

/**
 * Adds spaces to a given string so prefix matching is more efficient.
 */
function addSpaces(str: string) {
    return (
        str
            // Insert space between lowercase-to-uppercase (camelCase)
            .replace(/([a-z])([A-Z])/g, `$1${DELIMINATOR}$2`)
            // Insert space between sequences like "ABCDef" (PascalCase or acronyms)
            .replace(/([A-Z])([A-Z][a-z])/g, `$1${DELIMINATOR}$2`)
        // Note handling ABCdef is ambiguous with PascalCase handling
    );
}

export function getSearchDbQuery(cacheOptions: CacheOptions) {
    return queryOptions<MiniSearch>({
        queryKey: ["search-db"],
        queryFn: async () =>
            apiGet("/search-db", { cacheOptions }).then((result) => {
                if (!result.searchDb) {
                    throw new Error("No search database found");
                }
                return MiniSearch.loadJSON(result.searchDb, searchOptions);
            })
    });
}

export function useSearchDbQuery() {
    const cacheOptions = useCacheOptions();
    return useQuery(getSearchDbQuery(cacheOptions));
}

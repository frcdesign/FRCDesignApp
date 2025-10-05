import MiniSearch from "minisearch";
import { Documents, Elements, Vendor } from "../api/models";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useCacheOptions } from "../api/api";

export interface SearchDocument {
    id: string;
    documentId: string;
    isVisible: boolean;
    vendor: string;
    name: string;
    spacedName: string;
    documentName: string;
}

export async function buildSearchDb(
    documents: Documents,
    elements: Elements
): Promise<MiniSearch<SearchDocument>> {
    console.log("Building search database...");
    
    const searchDb = new MiniSearch<SearchDocument>({
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
            boost: { name: 2, spacedName: 2 },
            prefix: true,
            fuzzy: 0.2
        },
        // Custom tokenizer to split on special characters
        tokenize: (text: string) => {
            return text
                .toLowerCase()
                .split(/[-()#\s^]+/)
                .filter(Boolean);
        }
    });

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
    score: number;
}

export type SearchPositions = Record<string, Position[]>;

export async function doSearch(
    searchDb: MiniSearch<SearchDocument>,
    query?: string,
    filters?: SearchFilters
): Promise<SearchHit[]> {
    if (!query || query.trim() === "") {
        return [];
    }

    const results = searchDb.search(query, {
        boost: { name: 2, spacedName: 2 },
        prefix: true,
        fuzzy: 0.2
    });

    // Apply filters and add highlighting
    const hits: SearchHit[] = results
        .map((result) => {
            const storedFields = searchDb.getStoredFields(result.id);
            if (!storedFields) {
                return null;
            }
            const document = storedFields as unknown as SearchDocument;
            
            // Apply filters
            if (filters) {
                if (!document.isVisible) {
                    return null;
                }
                if (filters.documentId && document.documentId !== filters.documentId) {
                    return null;
                }
                if (
                    filters.vendors &&
                    filters.vendors.length > 0 &&
                    !filters.vendors.includes(document.vendor as Vendor)
                ) {
                    return null;
                }
            } else if (!document.isVisible) {
                return null;
            }

            // Generate highlighting positions
            const positions = generateHighlightPositions(document, query);

            return {
                id: result.id,
                document,
                positions,
                score: result.score
            };
        })
        .filter((hit): hit is SearchHit => hit !== null)
        .slice(0, 50); // Limit to 50 results

    return hits;
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
    const fields: (keyof SearchDocument)[] = ["name", "spacedName", "documentName"];
    
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
                if (/[-()#\s^]/.test(beforeChar) || /[-()#\s^]/.test(afterChar) || index === 0) {
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

/**
 * Hook to get or build the search database.
 * This hook depends on the documents and elements queries being available in the cache.
 */
export function useSearchDb() {
    const cacheOptions = useCacheOptions();
    
    return useQuery(
        queryOptions({
            queryKey: ["search-db", cacheOptions],
            queryFn: async ({ client }) => {
                // Get documents and elements from the query cache
                const documents = client.getQueryData<Documents>(["documents"]);
                const elements = client.getQueryData<Elements>(["elements"]);
                
                if (!documents || !elements) {
                    throw new Error("Documents and elements must be loaded before building search index");
                }
                
                return buildSearchDb(documents, elements);
            },
            staleTime: 5 * 60 * 1000 // 5 minutes
        })
    );
}

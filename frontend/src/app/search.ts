import { AnyOrama, create, insert } from "@orama/orama";
import { Documents, Elements, Vendor } from "../api/models";
import {
    afterInsert as highlightAfterInsert,
    Position,
    ResultWithPositions,
    searchWithHighlight
} from "@orama/plugin-match-highlight";
// import { persist } from "@orama/plugin-data-persistence";

export async function buildSearchDb(documents: Documents, elements: Elements) {
    console.log("Building search database...");
    const searchDb = create({
        schema: {
            id: "string",
            documentId: "string",
            isVisible: "boolean",
            vendor: "string",
            name: "string",
            spacedName: "string",
            documentName: "string"
        },
        components: {
            tokenizer: {
                language: "english",
                normalizationCache: new Map(),
                tokenize: (raw) => {
                    // In theory you could handle spacedName here, but in practice it doesn't work since the highlight algorithm doesn't recognize words in the middle of strings
                    // if (prop === "spacedName") {
                    //     raw = addSpaces(raw);
                    // }

                    // Filter removes empty strings
                    return raw
                        .toLowerCase()
                        .split(/[-()#\s^]+/)
                        .filter(Boolean);
                }
            }
        },
        plugins: [
            {
                name: "highlight",
                afterInsert: highlightAfterInsert
            }
            // {
            //     name: "split-on-case",
            //     beforeInsert: (_orama, _id, document) => {
            //         document.name = document.name.replace("-", " ");
            //         // const names: string[] = document.name;
            //         // const name: string = names[0];
            //         // const nameWithSpaces = addSpaces(name);
            //         // names.push(nameWithSpaces);
            //     }
            // }
        ]
    });

    // Cannot use insertMultiple since it doesn't return a Promise and there isn't a way to tell when it's actually finished...
    Object.values(elements).forEach((element) => {
        const parentDocument = documents[element.documentId];
        insert(searchDb, {
            id: element.id,
            documentId: element.documentId,
            isVisible: element.isVisible,
            vendor: element.vendor,
            name: element.name,
            spacedName: addSpaces(element.name),
            documentName: parentDocument.name
        });
    });
    // return persist(searchDb, "json");
}

export interface SearchFilters {
    documentId?: string;
    vendors?: Vendor[];
}

export async function doSearch(
    searchDb: AnyOrama,
    query?: string, // Shouldn't really be undefined but makes life easier in component
    filters?: SearchFilters
): Promise<SearchHit[]> {
    const where: Record<string, string | string[] | boolean> = {
        isVisible: true
    };

    if (filters) {
        // Orama is very touchy about null/undefined/[] in a where clause
        if (filters.documentId) {
            where.documentId = filters.documentId;
        }

        if (filters.vendors) {
            where.vendor = filters.vendors;
        }
    }

    const result = await searchWithHighlight(searchDb, {
        term: query,
        properties: ["name", "spacedName", "documentName"],
        boost: {
            name: 2,
            spacedName: 2
        },
        // ChatGPT suggested tuning for small documents
        relevance: {
            k: 0.5, // 0 - 0.5
            b: 0, // 0 - 0.2
            d: 1 // 1+
        },
        limit: 50,
        where
    });
    return result.hits;
}

export const DELIMINATOR = "^";

export type SearchHit = ResultWithPositions<any>;

export type SearchPositions = Record<string, Record<string, Position[]>>;

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

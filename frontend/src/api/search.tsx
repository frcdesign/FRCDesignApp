import { AnyOrama, create, insert } from "@orama/orama";
import { DocumentResult, Vendor } from "./backend-types";
import {
    afterInsert as highlightAfterInsert,
    Position,
    ResultWithPositions,
    searchWithHighlight
} from "@orama/plugin-match-highlight";
import { useState, useEffect } from "react";

let cachedSearchDb: AnyOrama | undefined = undefined;

function getCachedSearchDb() {
    return cachedSearchDb;
}

function setCachedSearchDb(searchDb: AnyOrama) {
    cachedSearchDb = searchDb;
}

/**
 * Returns the current cached search database.
 * If the database hasn't been accessed yet, this function will synchronously build it first.
 * This could produce a small latency on initial load, which we will ignore for now.
 */
export function useSearchDb(data: DocumentResult) {
    const [searchDb, setSearchDb] = useState<AnyOrama | undefined>(
        getCachedSearchDb()
    );

    useEffect(() => {
        if (getCachedSearchDb()) {
            setSearchDb(getCachedSearchDb());
        } else {
            const searchDb = buildSearchDb(data);
            setCachedSearchDb(searchDb);
            setSearchDb(searchDb);
        }
    }, [data]);

    return searchDb;
}

export function buildSearchDb(data: DocumentResult) {
    const searchDb = create({
        schema: {
            id: "string",
            documentId: "string",
            isVisible: "boolean",
            vendor: "string",
            name: "string",
            spacedName: "string"
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
                        .split(/[-()\s^]+/)
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
    Object.entries(data.documents).forEach(([documentId, document]) => {
        document.elementIds.forEach((elementId) => {
            const element = data.elements[elementId];
            insert(searchDb, {
                id: elementId,
                documentId,
                isVisible: element.isVisible,
                vendor: element.vendor,
                name: element.name,
                spacedName: addSpaces(element.name)
            });
        });
    });
    return searchDb;
}

export interface SearchFilters {
    documentId?: string;
    vendors?: Vendor[];
}

export async function doSearch(
    searchDb: AnyOrama,
    query: string,
    filters?: SearchFilters
): Promise<SearchHit[]> {
    const where: Record<string, string | string[] | boolean> = {
        isVisible: false
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
        properties: ["name", "spacedName"],
        // ChatGPT suggested tuning for small documents
        relevance: {
            k: 0.5, // 0 - 0.5
            b: 0, // 0 - 0.2
            d: 1 // 1+
        },
        limit: 30,
        where
    });
    return result.hits;
}

const deliminator = "^";

export type SearchHit = ResultWithPositions<any>;

export type SearchPositions = Record<string, Record<string, Position[]>>;

// Most of the following code is generated using ChatGPT with some modifications
export function addSpaces(str: string) {
    return (
        str
            // Insert space between lowercase-to-uppercase (camelCase)
            .replace(/([a-z])([A-Z])/g, `$1${deliminator}$2`)
            // Insert space between sequences like "ABCDef" (PascalCase or acronyms)
            .replace(/([A-Z])([A-Z][a-z])/g, `$1${deliminator}$2`)
        // Note handling ABCdef is ambiguous with PascalCase handling
    );
}

interface Range {
    start: number;
    length: number;
}

function applyRanges(str: string, ranges: Range[]) {
    ranges = deduplicateRanges(ranges);
    // Sort ranges by start to ensure processing order
    ranges = [...ranges].sort((a, b) => a.start - b.start);

    const result = [];
    let currentIndex = 0;

    for (const range of ranges) {
        const { start, length } = range;
        const end = start + length;

        // Add non-highlighted part before this range
        if (currentIndex < start) {
            result.push(str.slice(currentIndex, start));
        }

        // Add highlighted part
        // Array elements must have a key to avoid a warning
        result.push(<u key={currentIndex}>{str.slice(start, end)}</u>);

        currentIndex = end;
    }

    // Add the remaining non-highlighted part
    if (currentIndex < str.length) {
        result.push(str.slice(currentIndex));
    }

    return result;
}

function remapRanges(str: string, ranges: Range[]): Range[] {
    let offsetCount = 0;

    // Build mapping from original index → index in "clean" string
    const indexMap: number[] = [];
    for (let i = 0; i < str.length; i++) {
        if (str[i] === deliminator) {
            offsetCount++;
        } else {
            indexMap[i] = i - offsetCount;
        }
    }

    // Adjust ranges
    return ranges.map(({ start, length }) => {
        const newStart = indexMap[start];
        return { start: newStart, length };
    });
}

function deduplicateRanges(ranges: Range[]): Range[] {
    // Mapping where indexMap[i] = true means i is in a range.
    const indexMap: boolean[] = [];
    ranges.forEach((range) => {
        for (let i = 0; i < range.length; i++) {
            indexMap[range.start + i] = true;
        }
    });

    const merged: Range[] = [];
    // indexMap.length will always include the highest index set
    for (let i = 0; i < indexMap.length; i++) {
        if (!indexMap[i]) {
            continue;
        }
        const start = i;
        // Find length of range
        while (i < indexMap.length && indexMap[i]) {
            i++;
        }
        merged.push({ start, length: i - start });
    }
    return merged;
}

/**
 * Returns text highlighted with a searchHit.
 */
export function getSearchHitTitle(searchHit: SearchHit): JSX.Element {
    const positions: SearchPositions = searchHit.positions;
    const ranges = [];

    const spacedNameRanges = Object.values(positions.spacedName).flat(1);
    ranges.push(
        ...remapRanges(searchHit.document.spacedName, spacedNameRanges)
    );

    ranges.push(...Object.values(positions.name).flat(1));

    return <>{applyRanges(searchHit.document.name, ranges)}</>;
}

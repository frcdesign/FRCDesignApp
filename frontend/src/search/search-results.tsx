import { ReactNode } from "react";
import { Position, SearchHit, doSearch, useSearchDbQuery } from "./search";
import { useElementsQuery } from "../queries";
import { Vendor } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { ElementCard } from "../cards/element-card";
import {
    AppErrorState,
    AppInternalErrorState,
    AppLoadingState
} from "../common/app-zero-state";
import { FilterCallout } from "../navbar/filter-callout";
import { ClearFiltersButton } from "../navbar/vendor-filters";

interface SearchResultsProps {
    query: string;
    filters: {
        vendors?: Vendor[];
        documentId?: string;
    };
}

export function SearchResults(props: SearchResultsProps): ReactNode {
    const { query, filters } = props;

    const elementsQuery = useElementsQuery();
    const searchDbQuery = useSearchDbQuery();

    const searchResultSelectedMutation = useMutation({
        mutationKey: ["search-result-selected"],
        mutationFn: async () => apiPost("/search-result-selected")
    });

    if (searchDbQuery.isPending || elementsQuery.isPending) {
        return <AppLoadingState title="Loading documents..." />;
    } else if (
        searchDbQuery.isError ||
        elementsQuery.isError ||
        searchDbQuery.data === undefined
    ) {
        return (
            <AppInternalErrorState title="Unexpectedly failed to load documents." />
        );
    }
    const elements = elementsQuery.data;
    const searchResults = doSearch(searchDbQuery.data, query, filters);

    if (searchResults.hits.length === 0) {
        if (searchResults.filtered > 0) {
            return (
                <AppErrorState
                    icon="search"
                    iconIntent="primary"
                    title="No search results."
                    description={`${searchResults.filtered} search results are hidden by filters.`}
                    action={<ClearFiltersButton />}
                />
            );
        }
        return (
            <AppErrorState
                icon="search"
                iconIntent="primary"
                title="No search results"
            />
        );
    }
    const callout = (
        <FilterCallout
            itemName="search results"
            filteredItems={searchResults.filtered}
        />
    );
    const resultCards = searchResults.hits.map((searchHit: SearchHit) => {
        const elementId = searchHit.document.id;
        const element = elements[elementId];
        return (
            <ElementCard
                key={elementId}
                element={element}
                searchHit={searchHit}
                onClick={() => searchResultSelectedMutation.mutate()}
            />
        );
    });

    return (
        <>
            {callout}
            {resultCards}
        </>
    );
}

function applyRanges(str: string, ranges: Position[]) {
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

// function remapRanges(str: string, ranges: Position[]): Position[] {
//     let offsetCount = 0;

//     // Build mapping from original index → index in "clean" string
//     const indexMap: number[] = [];
//     for (let i = 0; i < str.length; i++) {
//         if (str[i] === DELIMINATOR) {
//             offsetCount++;
//         } else {
//             indexMap[i] = i - offsetCount;
//         }
//     }

//     // Adjust ranges
//     return ranges.map(({ start, length }) => {
//         const newStart = indexMap[start];
//         return { start: newStart, length };
//     });
// }

function deduplicateRanges(ranges: Position[]): Position[] {
    // Mapping where indexMap[i] = true means i is in a range.
    const indexMap: boolean[] = [];
    ranges.forEach((range) => {
        for (let i = 0; i < range.length; i++) {
            indexMap[range.start + i] = true;
        }
    });

    const merged: Position[] = [];
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

interface SearchHitTitleProps {
    searchHit: SearchHit;
}

/**
 * Returns text highlighted with a searchHit.
 */
export function SearchHitTitle(props: SearchHitTitleProps): ReactNode {
    const { searchHit } = props;
    return <>{applyRanges(searchHit.document.name, searchHit.positions)}</>;
}

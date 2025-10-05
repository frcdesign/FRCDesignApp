import { ReactNode, useState, useEffect } from "react";
import {
    SearchHit,
    SearchPositions,
    DELIMINATOR,
    doSearch,
    useSearchDb
} from "./search";
import { useDocumentsQuery, useElementsQuery } from "../queries";
import { Vendor } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { ElementCard } from "../cards/element-card";
import { AppErrorState, AppLoadingState } from "../common/app-zero-state";
import { FilterCallout } from "../navbar/filter-callout";
import { useUiState } from "../api/ui-state";
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
    const documentsQuery = useDocumentsQuery();

    const searchDb = useSearchDb(documentsQuery.data, elementsQuery.data);
    const uiState = useUiState()[0];

    const [searchHits, setSearchHits] = useState<SearchHit[] | undefined>(
        undefined
    );

    const searchResultSelectedMutation = useMutation({
        mutationKey: ["search-result-selected"],
        mutationFn: async () => apiPost("/search-result-selected")
    });

    useEffect(() => {
        const executeSearch = async () => {
            if (!searchDb) {
                return;
            }
            const hits = await doSearch(searchDb, query, filters);
            setSearchHits(hits);
        };

        executeSearch();
    }, [searchDb, query, filters]);

    if (
        !searchDb ||
        !searchHits ||
        !elementsQuery.data ||
        !documentsQuery.data
    ) {
        return <AppLoadingState title="Building search index..." />;
    }
    const elements = elementsQuery.data;
    const hasFilters = uiState.vendorFilters !== undefined;

    if (searchHits.length === 0) {
        if (hasFilters) {
            return (
                <AppErrorState
                    icon="search"
                    iconIntent="primary"
                    title="No search results."
                    description="Some search results may be hidden by filters."
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
    const callout = <FilterCallout itemType="search results" />;
    const searchResults = searchHits.map((searchHit: SearchHit) => {
        const elementId = searchHit.id;
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
            {searchResults}
        </>
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
        if (str[i] === DELIMINATOR) {
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

interface SearchHitTitleProps {
    searchHit: SearchHit;
}

/**
 * Returns text highlighted with a searchHit, or title if searchHit is undefined.
 */
export function SearchHitTitle(props: SearchHitTitleProps): ReactNode {
    const { searchHit } = props;

    const positions: SearchPositions = searchHit.positions;
    const ranges = [];

    const spacedNameRanges = Object.values(positions.spacedName).flat(1);
    ranges.push(
        ...remapRanges(searchHit.document.spacedName, spacedNameRanges)
    );

    ranges.push(...Object.values(positions.name).flat(1));

    return <>{applyRanges(searchHit.document.name, ranges)}</>;
}

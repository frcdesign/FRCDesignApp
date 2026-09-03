import { useAccessData } from "../../auth/access-level";
import { ReactNode } from "react";
import { Position, SearchFilters, SearchHit } from "../search";
import { searchInsertables } from "../filter";
import { InsertableCard } from "../../library/components/insertable-card";
import { ItemTable } from "../../library/components/card-components";
import {
    SectionError,
    SectionLoading
} from "../../../components/app-zero-state";
import { NoSearchResultError, SearchCallout } from "./search-errors";
import { useLibraryQuery } from "../../library/queries";
import { useSearchDbQuery } from "../queries";
import { hasEditorAccess } from "@backend/features/auth/access-level";

interface SearchResultsProps {
    query: string;
    filters: SearchFilters;
}

/**
 * Given a valid search query and filters, returns the list of current elements.
 */
export function SearchResults(props: SearchResultsProps): ReactNode {
    const { query, filters } = props;

    const libraryQuery = useLibraryQuery();
    const searchDbQuery = useSearchDbQuery();
    const accessData = useAccessData();

    if (searchDbQuery.isPending || libraryQuery.isPending) {
        return <SectionLoading title="Loading library..." />;
    } else if (libraryQuery.isError) {
        return <SectionError title="Failed to load library." />;
    } else if (searchDbQuery.isError) {
        return <SectionError title="Failed to load search database." />;
    } else if (!searchDbQuery.data) {
        return <SectionError title="The search database is empty." />;
    }
    const result = searchInsertables({
        searchDb: searchDbQuery.data,
        insertables: libraryQuery.data.insertables,
        query,
        filters,
        showHidden: hasEditorAccess(accessData.currentAccessLevel)
    });

    if (result.insertables.length === 0) {
        return (
            <NoSearchResultError
                objectLabel="search result"
                filtered={result.filtered}
            />
        );
    }

    const resultCards = result.insertables.map((insertable) => (
        <InsertableCard
            key={insertable.id}
            insertable={insertable}
            searchHit={result.hits[insertable.id]}
        />
    ));

    return (
        <>
            <SearchCallout
                objectLabel="search result"
                filtered={result.filtered}
            />
            <ItemTable>{resultCards}</ItemTable>
        </>
    );
}

interface SearchHitTitleProps {
    title: string;
    searchHit: SearchHit;
}

/**
 * Returns text highlighted with a searchHit.
 */
export function SearchHitTitle(props: SearchHitTitleProps): ReactNode {
    const { title, searchHit } = props;
    return <HighlightedText text={title} positions={searchHit.positions} />;
}

/** Underlines wherever the query matched inside `text`. */
export function HighlightedText({
    text,
    positions
}: {
    text: string;
    positions?: Position[];
}): ReactNode {
    return <>{applyRanges(text, positions ?? [])}</>;
}

function applyRanges(str: string, ranges: Position[]) {
    ranges = deduplicateRanges(ranges);
    // Sort ranges by start to ensure processing order
    ranges = [...ranges].sort((a, b) => a.start - b.start);

    const result: ReactNode[] = [];
    let currentIndex = 0;

    for (const range of ranges) {
        const { start, length } = range;
        const end = start + length;

        if (currentIndex < start) {
            result.push(str.slice(currentIndex, start));
        }

        result.push(<u key={currentIndex}>{str.slice(start, end)}</u>);

        currentIndex = end;
    }

    if (currentIndex < str.length) {
        result.push(str.slice(currentIndex));
    }

    return result;
}

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

import { useAccessData } from "../../auth/access-level";
import { ReactNode } from "react";
import { Position, SearchFilters, SearchHit } from "../search";
import { searchInsertables } from "../filter";
import { InsertableCard } from "../../library/components/insertable-card";
import { ItemTable } from "../../library/components/card-components";
import {
    SectionNotice,
    SectionLoading
} from "../../../components/app-zero-state";
import { NoSearchResultError, SearchCallout } from "./search-errors";
import { useLibraryQuery } from "../../library/queries";
import { useSearchDbQuery } from "../queries";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { InsertSource } from "@backend/features/analytics/events";

interface SearchResultsProps {
    query: string;
    filters: SearchFilters;
    /**
     * Which search this is. Required rather than defaulted: the whole point of
     * telling them apart is that neither is the obvious one.
     */
    source: InsertSource.SEARCH | InsertSource.GROUP_SEARCH;
}

/**
 * Given a valid search query and filters, returns the list of current elements.
 */
export function SearchResults(props: SearchResultsProps): ReactNode {
    const { query, filters, source } = props;

    const libraryQuery = useLibraryQuery();
    const searchDbQuery = useSearchDbQuery();
    const accessData = useAccessData();

    if (searchDbQuery.isPending || libraryQuery.isPending) {
        return <SectionLoading title="Loading library..." />;
    } else if (libraryQuery.isError) {
        return <SectionNotice title="Failed to load library." />;
    } else if (searchDbQuery.isError) {
        return <SectionNotice title="Failed to load search database." />;
    } else if (!searchDbQuery.data) {
        return <SectionNotice title="The search database is empty." />;
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
            source={source}
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
interface HighlightedTextProps {
    text: string;
    /** Where the query matched; nothing highlights when absent. */
    positions?: Position[];
}

export function HighlightedText(props: HighlightedTextProps): ReactNode {
    const { text, positions = [] } = props;
    return <>{applyRanges(text, positions)}</>;
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
        while (i < indexMap.length && indexMap[i]) {
            i++;
        }
        merged.push({ start, length: i - start });
    }
    return merged;
}

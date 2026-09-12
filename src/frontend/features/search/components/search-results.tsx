import { useShowHidden } from "../../auth/access-level";
import { ReactNode } from "react";
import { SearchFilters } from "../search";
import { searchInsertables } from "../filter";
import { InsertableCard } from "../../library/components/insertable-card";
import { ItemTable } from "../../../components/item-row";
import {
    SectionNotice,
    SectionLoading
} from "../../../components/app-zero-state";
import { NoSearchResultError, SearchCallout } from "./search-errors";
import { useLibraryQuery } from "../../library/queries";
import { useSearchDbQuery } from "../queries";
import { InsertSource } from "@backend/features/analytics/usage";

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
    const showHidden = useShowHidden();

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
        showHidden
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
            match={result.hits[insertable.id]}
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

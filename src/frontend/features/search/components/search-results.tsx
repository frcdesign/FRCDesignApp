import { useShowHidden } from "../../auth/access-level";
import { ReactNode } from "react";
import { SearchFilters } from "../search";
import { searchInsertables } from "../filter";
import { InsertableCard } from "../../library/components/insertable-card";
import { ItemTable } from "../../../components/item-row";
import { SectionLoading, SectionError } from "../../../components/app-notice";
import { NoSearchResultError, SearchCallout } from "./search-errors";
import { useLibraryQuery } from "../../library/queries";
import { useSearchDbQuery } from "../queries";
import { UseSource } from "@backend/features/analytics/usage";
import { useCurrentTeamSettings } from "../../teams/queries";

interface SearchResultsProps {
    query: string;
    filters: SearchFilters;
    /** Required: neither is the obvious default. */
    source: UseSource.SEARCH | UseSource.GROUP_SEARCH;
}

export function SearchResults(props: SearchResultsProps): ReactNode {
    const { query, filters, source } = props;

    const libraryQuery = useLibraryQuery();
    const searchDbQuery = useSearchDbQuery();
    const showHidden = useShowHidden();
    const teamSettings = useCurrentTeamSettings();

    if (searchDbQuery.isPending || libraryQuery.isPending) {
        return <SectionLoading title="Loading library..." />;
    } else if (libraryQuery.isError) {
        return (
            <SectionError
                title="Failed to load library."
                error={libraryQuery.error}
            />
        );
    } else if (searchDbQuery.isError) {
        return (
            <SectionError
                title="Failed to load search database."
                error={searchDbQuery.error}
            />
        );
    } else if (!searchDbQuery.data) {
        return <SectionError title="The search database is empty." />;
    }
    const result = searchInsertables({
        searchDb: searchDbQuery.data,
        insertables: libraryQuery.data.insertables,
        query,
        filters,
        showHidden,
        vendorRanking: teamSettings?.vendorRanking
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

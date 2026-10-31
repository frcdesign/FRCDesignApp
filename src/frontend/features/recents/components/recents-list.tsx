import { ReactNode } from "react";
import type { RecentInsert } from "@backend/features/recents/contract";
import type { Insertables } from "@backend/features/library/contract";
import { filterInsertables } from "../../search/filter";
import { doSearch, type SearchHit } from "../../search/search";
import {
    SectionNotice,
    SectionLoading,
    SectionError
} from "../../../components/app-notice";
import { IconSize } from "../../../lib/style-constants";
import {
    NoSearchResultError,
    SearchCallout
} from "../../search/components/search-errors";
import { ItemTable } from "../../../components/item-row";
import { useUiState } from "../../../lib/ui-state";
import { useLibraryQuery } from "../../library/queries";
import { useSearchDbQuery } from "../../search/queries";
import { useVendorFilters } from "../../settings/vendor-filters";
import { useRecentsQuery } from "../queries";
import { RecentCard } from "./recent-card";
import { RecentIcon } from "./recent-icon";

/** Only shown signed in. Searched within itself, like the favorites list. */
export function RecentsList(): ReactNode {
    const searchQuery = useUiState((state) => state.searchQuery);
    const recentsQuery = useRecentsQuery();
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isPending || recentsQuery.isPending) {
        return <SectionLoading title="Loading recently used parts..." />;
    } else if (libraryQuery.isError || recentsQuery.isError) {
        return <SectionError title="Failed to load recently used parts." />;
    }

    const insertables = libraryQuery.data.insertables;
    const { recents } = recentsQuery.data;
    if (recents.length === 0) {
        return (
            <SectionNotice
                icon={<RecentIcon size={IconSize.SECTION} />}
                title="Nothing inserted yet."
                description="The parts you insert are listed here."
            />
        );
    }

    if (searchQuery) {
        return (
            <RecentSearchResults
                query={searchQuery}
                recents={recents}
                insertables={insertables}
            />
        );
    }
    return <RecentCards recents={recents} insertables={insertables} />;
}

interface RecentSearchResultsProps {
    query: string;
    recents: RecentInsert[];
    insertables: Insertables;
}

/** The recents whose part the query matches, still newest first. */
function RecentSearchResults(props: RecentSearchResultsProps): ReactNode {
    const { query, recents, insertables } = props;

    const searchDbQuery = useSearchDbQuery();

    if (searchDbQuery.isLoading) {
        return <SectionLoading title="Searching..." />;
    } else if (searchDbQuery.isError) {
        return <SectionError title="Failed to load search database." />;
    } else if (!searchDbQuery.data) {
        return <SectionError title="The search database is empty." />;
    }

    const { hits } = doSearch({
        searchDb: searchDbQuery.data,
        query,
        filters: {
            insertableIds: new Set(recents.map((recent) => recent.insertableId))
        },
        // A row is one configuration, so other configurations' fields mustn't match.
        searchConfigurations: false,
        // Left to `RecentCards`, which counts what it drops per row.
        showHidden: true
    });
    const hitsById = Object.fromEntries(hits.map((hit) => [hit.id, hit]));

    return (
        <RecentCards
            recents={recents.filter((recent) => hitsById[recent.insertableId])}
            insertables={insertables}
            hits={hitsById}
        />
    );
}

interface RecentCardsProps {
    recents: RecentInsert[];
    insertables: Insertables;
    /** Where a search matched each part, by insertable id. */
    hits?: Record<string, SearchHit>;
}

/** The rows themselves, narrowed by what the user may see and the vendor filters. */
function RecentCards(props: RecentCardsProps): ReactNode {
    const { recents, insertables, hits = {} } = props;

    const vendorFilters = useVendorFilters();

    const resolved = recents.flatMap((recent) => {
        const insertable = insertables[recent.insertableId];
        return insertable ? [{ recent, insertable }] : [];
    });
    // One entry per row, so a part listed twice is counted twice.
    const result = filterInsertables(
        resolved.map((row) => row.insertable),
        { vendors: vendorFilters, visibleOnly: true }
    );
    const kept = new Set(result.insertables.map((insertable) => insertable.id));
    const rows = resolved.filter((row) => kept.has(row.insertable.id));

    if (rows.length === 0) {
        return (
            <NoSearchResultError
                objectLabel="recently used part"
                filtered={result.filtered}
            />
        );
    }

    return (
        <>
            <SearchCallout
                objectLabel="recently used part"
                filtered={result.filtered}
            />
            <ItemTable>
                {rows.map(({ recent, insertable }) => (
                    <RecentCard
                        key={recent.id}
                        insertable={insertable}
                        recent={recent}
                        searchHit={hits[insertable.id]}
                    />
                ))}
            </ItemTable>
        </>
    );
}

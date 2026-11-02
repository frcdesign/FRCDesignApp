import { ReactNode } from "react";
import type { RecentInsert } from "@backend/features/recents/contract";
import type {
    Insertables,
    LibraryOut
} from "@backend/features/library/contract";
import { filterInsertables } from "../../search/filter";
import { type SearchHit } from "../../search/search";
import { searchList } from "../../search/list-search";
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
                title="Nothing inserted yet"
            />
        );
    }

    if (searchQuery) {
        return (
            <RecentCards
                {...searchRecents(recents, libraryQuery.data, searchQuery)}
            />
        );
    }
    return <RecentCards recents={recents} insertables={insertables} />;
}

/** The recents the query matches, ranked, each by its own configuration's part number. */
function searchRecents(
    recents: RecentInsert[],
    library: LibraryOut,
    query: string
): RecentCardsProps {
    const rows = recents.flatMap((recent) => {
        const insertable = library.insertables[recent.insertableId];
        return insertable
            ? [
                  {
                      id: recent.id,
                      insertable,
                      groupName: library.groups[insertable.groupId]?.name ?? "",
                      record: recent.record,
                      recent
                  }
              ]
            : [];
    });
    const found = searchList(rows, query);
    return {
        recents: found.map(({ row }) => row.recent),
        insertables: library.insertables,
        hits: Object.fromEntries(found.map(({ row, hit }) => [row.id, hit]))
    };
}

interface RecentCardsProps {
    recents: RecentInsert[];
    insertables: Insertables;
    /** Where a search matched each row, by recent id. */
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
                        searchHit={hits[recent.id]}
                    />
                ))}
            </ItemTable>
        </>
    );
}

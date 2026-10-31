import { ReactNode } from "react";
import { filterInsertables } from "../../search/filter";
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
import { useLibraryQuery } from "../../library/queries";
import { useVendorFilters } from "../../settings/vendor-filters";
import { useRecentsQuery } from "../queries";
import { RecentCard } from "./recent-card";
import { RecentIcon } from "./recent-icon";

/** Only shown signed in: inserting takes an Onshape account, so signed out has none. */
export function RecentsList(): ReactNode {
    const vendorFilters = useVendorFilters();
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

    const recentsById = new Map(
        recents.map((recent) => [recent.insertableId, recent])
    );

    const result = filterInsertables(
        recents
            .map((recent) => insertables[recent.insertableId])
            .filter((insertable) => !!insertable),
        { vendors: vendorFilters, visibleOnly: true }
    );

    if (result.insertables.length === 0) {
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
                {result.insertables.map((insertable) => {
                    const recent = recentsById.get(insertable.id);
                    return (
                        recent && (
                            <RecentCard
                                key={insertable.id}
                                insertable={insertable}
                                recent={recent}
                            />
                        )
                    );
                })}
            </ItemTable>
        </>
    );
}

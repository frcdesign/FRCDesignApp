import { HeartBreakIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";
import { FilteredInsertables, filterInsertables } from "../../search/filter";
import { searchList } from "../../search/list-search";
import {
    getFavoriteForInsertable,
    type FavoritesData
} from "@backend/features/favorites/contract";
import type { LibraryOut } from "@backend/features/library/contract";
import { useUiState } from "../../../lib/ui-state";
import { SectionLoading, SectionError } from "../../../components/app-notice";
import {
    NoSearchResultError,
    SearchCallout
} from "../../search/components/search-errors";
import { FavoriteCard } from "./favorite-card";
import { ItemTable } from "../../../components/item-row";
import { useFavoritesQuery } from "../queries";
import { useLibraryQuery } from "../../library/queries";
import { AppIcon } from "../../../components/app-icon";
import { useVendorFilters } from "../../settings/vendor-filters";

/** Only shown signed in. Unlike DocumentList, this list can be searched directly. */
export function FavoritesList(): ReactNode {
    const searchQuery = useUiState((state) => state.searchQuery);
    const vendorFilters = useVendorFilters();

    const favoritesQuery = useFavoritesQuery();
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isPending || favoritesQuery.isPending) {
        return <SectionLoading title="Loading favorites..." />;
    } else if (libraryQuery.isError || favoritesQuery.isError) {
        return (
            <SectionError
                title="Failed to load favorites."
                icon={
                    <AppIcon
                        icon={HeartBreakIcon}
                        size={IconSize.SECTION}
                        color={StatusColor.ERROR}
                    />
                }
            />
        );
    }

    const insertables = libraryQuery.data.insertables;
    const favoritesData = favoritesQuery.data;

    if (searchQuery) {
        return (
            <FavoriteSearchResults
                query={searchQuery}
                library={libraryQuery.data}
                favoritesData={favoritesData}
            />
        );
    }

    const favoriteInsertables = favoritesData.favoriteOrder
        .map((favoriteId) => favoritesData.favorites[favoriteId])
        .filter((favorite) => !!favorite)
        .map((favorite) => insertables[favorite.insertableId])
        .filter((insertable) => !!insertable);

    return (
        <FavoriteCards
            result={filterInsertables(favoriteInsertables, {
                vendors: vendorFilters,
                visibleOnly: true
            })}
            favoritesData={favoritesData}
        />
    );
}

interface FavoriteSearchResultsProps {
    query: string;
    library: LibraryOut;
    favoritesData: FavoritesData;
}

/** The favorites the query matches, ranked, each by its own configuration's part number. */
function FavoriteSearchResults(props: FavoriteSearchResultsProps): ReactNode {
    const { query, library, favoritesData } = props;

    const vendorFilters = useVendorFilters();

    const rows = favoritesData.favoriteOrder.flatMap((favoriteId) => {
        const favorite = favoritesData.favorites[favoriteId];
        const insertable =
            favorite && library.insertables[favorite.insertableId];
        return insertable
            ? [
                  {
                      id: favorite.id,
                      insertable,
                      groupName: library.groups[insertable.groupId]?.name ?? "",
                      record: favorite.record
                  }
              ]
            : [];
    });
    const found = searchList(rows, query);
    const result = filterInsertables(
        found.map(({ row }) => row.insertable),
        { vendors: vendorFilters, visibleOnly: true }
    );
    // A part has one favorite, so its id names the hit.
    const hits = Object.fromEntries(
        found.map(({ row, hit }) => [row.insertable.id, hit])
    );

    return (
        <FavoriteCards
            result={{ ...result, hits }}
            favoritesData={favoritesData}
        />
    );
}

interface FavoriteCardsProps {
    result: FilteredInsertables;
    favoritesData: FavoritesData;
}

/** The rows themselves, however the list they show was narrowed down. */
function FavoriteCards(props: FavoriteCardsProps): ReactNode {
    const { result, favoritesData } = props;
    const { insertables, filtered, hits } = result;

    if (insertables.length === 0) {
        return (
            <NoSearchResultError objectLabel="favorite" filtered={filtered} />
        );
    }

    const cards = insertables.map((insertable) => {
        const favorite = getFavoriteForInsertable(
            favoritesData.favorites,
            insertable.id
        );
        if (!favorite) {
            return null; // Shouldn't happen
        }
        return (
            <FavoriteCard
                key={favorite.id}
                insertable={insertable}
                favorite={favorite}
                searchHit={hits[insertable.id]}
            />
        );
    });

    return (
        <>
            <SearchCallout objectLabel="favorite" filtered={filtered} />
            <ItemTable>{cards}</ItemTable>
        </>
    );
}

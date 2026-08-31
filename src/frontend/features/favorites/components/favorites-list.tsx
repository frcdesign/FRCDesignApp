import { useAccessData } from "../../auth/access-level";
import { HeartBreakIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode } from "react";
import {
    FilteredInsertables,
    filterInsertables,
    searchInsertables
} from "../../search/filter";
import { getFavoriteForInsertable } from "@backend/features/favorites/contract";
import type { FavoritesData } from "@backend/features/favorites/contract";
import type { Insertables } from "@backend/features/library/contract";
import { useGetUiState } from "../../../lib/ui-state";
import {
    SectionError,
    SectionLoading
} from "../../../components/app-zero-state";
import {
    NoSearchResultError,
    SearchCallout
} from "../../search/components/search-errors";
import { FavoriteCard } from "./favorite-card";
import { ItemTable } from "../../library/components/card-components";
import { useFavoritesQuery } from "../queries";
import { useLibraryQuery } from "../../library/queries";
import { useSearchDbQuery } from "../../search/queries";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { AppIcon } from "../../../components/app-icon";

/**
 * A list of current favorite cards.
 * Unlike the normal DocumentList, this list can be searched directly.
 */
export function FavoritesList(): ReactNode {
    const { searchQuery, vendorFilters } = useGetUiState();

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
                insertables={insertables}
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
                isVisible: true
            })}
            favoritesData={favoritesData}
        />
    );
}

interface FavoriteSearchResultsProps {
    query: string;
    insertables: Insertables;
    favoritesData: FavoritesData;
}

/** The favorites the query matches, which the search index is what knows. */
function FavoriteSearchResults(props: FavoriteSearchResultsProps): ReactNode {
    const { query, insertables, favoritesData } = props;

    const vendorFilters = useGetUiState().vendorFilters;
    const accessData = useAccessData();
    const searchDbQuery = useSearchDbQuery();

    if (searchDbQuery.isLoading) {
        return <SectionLoading title="Searching..." />;
    } else if (searchDbQuery.isError) {
        return <SectionError title="Failed to load search database." />;
    } else if (!searchDbQuery.data) {
        return <SectionError title="The search database is empty." />;
    }

    const result = searchInsertables({
        searchDb: searchDbQuery.data,
        insertables,
        query,
        filters: { vendors: vendorFilters, isFavorite: true },
        favoritedInsertableIds: new Set(
            Object.values(favoritesData.favorites).map((f) => f.insertableId)
        ),
        showHidden: hasEditorAccess(accessData.currentAccessLevel)
    });

    return <FavoriteCards result={result} favoritesData={favoritesData} />;
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

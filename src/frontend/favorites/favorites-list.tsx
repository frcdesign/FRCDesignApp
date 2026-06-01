import { Colors, Card } from "@blueprintjs/core";
import { ReactNode } from "react";
import { filterInsertables } from "../search/filter";
import {
    getFavoriteForInsertable,
    InsertableOut
} from "../../shared/api-models";
import { useUiState } from "../api-utils/ui-state";
import { SectionError, SectionLoading } from "../common/app-zero-state";
import { NoSearchResultError, SearchCallout } from "../search/search-errors";
import { FavoriteCard } from "./favorite-card";
import {
    useFavoritesQuery,
    useLibraryQuery,
    useSearchDbQuery
} from "../queries";
import { doSearch, FilterResult, SearchHit } from "../search/search";

/**
 * A list of current favorite cards.
 * Unlike the normal DocumentList, this list can be searched directly.
 */
export function FavoritesList(): ReactNode {
    const uiState = useUiState()[0];

    const favoritesQuery = useFavoritesQuery();
    const libraryQuery = useLibraryQuery();
    const searchDbQuery = useSearchDbQuery();

    if (
        libraryQuery.isPending ||
        searchDbQuery.isPending ||
        favoritesQuery.isPending
    ) {
        return <SectionLoading title="Loading favorites..." />;
    } else if (
        libraryQuery.isError ||
        searchDbQuery.isError ||
        favoritesQuery.isError
    ) {
        return (
            <SectionError
                title="Failed to load favorites."
                icon="heart-broken"
                iconColor={Colors.RED3}
            />
        );
    }

    const insertables = libraryQuery.data.insertables;

    const orderedFavorites = favoritesQuery.data.favoriteOrder
        .map((favoriteId) => favoritesQuery.data.favorites[favoriteId])
        .filter((favorite) => !!favorite);

    const favoriteInsertables = orderedFavorites
        .map((favorite) => insertables[favorite.insertableId])
        .filter((insertable) => !!insertable);

    let filteredInsertables: InsertableOut[];
    let filterResult: FilterResult;
    let searchHits: Record<string, SearchHit> = {};
    if (uiState.searchQuery) {
        if (!searchDbQuery.data) {
            return <SectionError title="Failed to load search database." />;
        }
        const favoriteInsertableIds = new Set(
            Object.values(favoritesQuery.data.favorites).map(
                (f) => f.insertableId
            )
        );
        const searchResults = doSearch(
            searchDbQuery.data,
            uiState.searchQuery,
            {
                vendors: uiState.vendorFilters,
                isFavorite: true
            },
            favoriteInsertableIds
        );

        filteredInsertables = searchResults.hits
            .map((hit) => insertables[hit.id])
            .filter((insertable) => !!insertable);

        filterResult = searchResults.filtered;

        searchHits = searchResults.hits.reduce(
            (acc, hit) => {
                acc[hit.id] = hit;
                return acc;
            },
            {} as Record<string, SearchHit>
        );
    } else {
        const filterResult2 = filterInsertables(favoriteInsertables, {
            vendors: uiState.vendorFilters,
            isVisible: true
        });

        filteredInsertables = filterResult2.insertables;
        filterResult = filterResult2.filtered;
    }

    if (filteredInsertables.length === 0) {
        return (
            <NoSearchResultError
                objectLabel="favorite"
                filtered={filterResult}
            />
        );
    }

    let callout: ReactNode = null;
    if (filterResult.byDocument > 0 || filterResult.byVendor > 0) {
        callout = (
            <Card className="item-card" style={{ padding: "0px" }}>
                <SearchCallout objectLabel="favorite" filtered={filterResult} />
            </Card>
        );
    }

    const cards = filteredInsertables.map((insertable: InsertableOut) => {
        const favorite = getFavoriteForInsertable(
            favoritesQuery.data.favorites,
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
                searchHit={searchHits[insertable.id]}
            />
        );
    });

    return (
        <>
            {callout}
            {cards}
        </>
    );
}

import { Colors, Card } from "@blueprintjs/core";
import { ReactNode } from "react";
import { filterElements } from "../search/filter";
import { ElementObj } from "../api/models";
import { useUiState } from "../api/ui-state";
import {
    AppInternalErrorState,
    AppLoadingState
} from "../common/app-zero-state";
import { NoSearchResultError, SearchCallout } from "../search/search-errors";
import { FavoriteCard } from "./favorite-card";
import {
    useLibraryQuery,
    useLibraryUserDataQuery,
    useSearchDbQuery
} from "../queries";
import { doSearch, FilterResult, SearchHit } from "../search/search";

/**
 * A list of current favorite cards.
 * Unlike the normal DocumentList, this list can be searched directly.
 */
export function FavoritesList(): ReactNode {
    const uiState = useUiState()[0];

    const libraryQuery = useLibraryQuery();
    const userDataQuery = useLibraryUserDataQuery();
    const searchDbQuery = useSearchDbQuery();

    if (
        userDataQuery.isPending ||
        libraryQuery.isPending ||
        searchDbQuery.isPending
    ) {
        return <AppLoadingState title="Loading favorites..." />;
    } else if (
        libraryQuery.isError ||
        userDataQuery.isError ||
        searchDbQuery.isError
    ) {
        return (
            <AppInternalErrorState
                title="Failed to load favorites."
                icon="heart-broken"
                iconColor={Colors.RED3}
                inline
            />
        );
    }

    const userData = userDataQuery.data;
    const elements = libraryQuery.data.elements;

    const orderedFavorites = userData.favoriteOrder
        .map((favoriteId) => userData.favorites[favoriteId])
        .filter((favorite) => !!favorite);

    // Only ever show elements that aren't hidden
    const favoriteElements = orderedFavorites
        .map((favorite) => elements[favorite.id])
        .filter((element) => !!element);

    let filteredElements: ElementObj[];
    let filterResult: FilterResult;
    let searchHits: Record<string, SearchHit> = {};
    if (uiState.searchQuery) {
        if (!searchDbQuery.data) {
            return (
                <AppInternalErrorState title="Failed to load search database." />
            );
        }
        const searchResults = doSearch(
            searchDbQuery.data,
            uiState.searchQuery,
            {
                vendors: uiState.vendorFilters,
                isFavorite: true
            },
            userData.favorites
        );

        // Search hits are just ids and positions, so convert back into array of elements
        filteredElements = searchResults.hits
            .map((hit) => elements[hit.id])
            .filter((element) => !!element);

        filterResult = searchResults.filtered;

        // To get the search hits later build a map of actual hits as well
        searchHits = searchResults.hits.reduce((searchHits, hit) => {
            searchHits[hit.id] = hit;
            return searchHits;
        }, {} as Record<string, SearchHit>);
    } else {
        const filterElementResult = filterElements(favoriteElements, {
            vendors: uiState.vendorFilters,
            // Only elements which haven't been disabled can be shown
            isVisible: true
        });

        filteredElements = filterElementResult.elements;
        filterResult = filterElementResult.filtered;
    }

    if (filteredElements.length === 0) {
        return (
            <NoSearchResultError
                objectLabel="favorite"
                filtered={filterResult}
            />
        );
    }

    let callout = null;
    // Favorites specifically are displayed inline inside a ListContainer, so we need to wrap a custom Card around it
    // So we can't rely on SearchCallout returning null :(
    if (filterResult.byDocument > 0 || filterResult.byVendor > 0) {
        callout = (
            <Card className="item-card" style={{ padding: "0px" }}>
                <SearchCallout objectLabel="favorite" filtered={filterResult} />
            </Card>
        );
    }

    const cards = filteredElements.map((element: ElementObj) => {
        // Fetch the favorite again so we have it's data
        const favorite = userData.favorites[element.id];
        if (!favorite) {
            return null; // Shouldn't happen
        }
        return (
            <FavoriteCard
                key={favorite.id}
                element={element}
                favorite={favorite}
                searchHit={searchHits[element.id]}
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

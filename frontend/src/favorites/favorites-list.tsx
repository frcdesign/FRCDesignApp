import { Colors, Card } from "@blueprintjs/core";
import { ReactNode } from "react";
import { filterElements } from "../search/filter";
import { ElementObj } from "../api/models";
import { useUiState } from "../api/ui-state";
import {
    AppInternalErrorState,
    AppLoadingState,
    AppErrorState
} from "../common/app-zero-state";
import { FilterCallout } from "../navbar/filter-callout";
import { ClearFiltersButton } from "../navbar/vendor-filters";
import { FavoriteCard } from "./favorite-card";
import {
    useLibraryQuery,
    useLibraryUserDataQuery,
    useSearchDbQuery
} from "../queries";
import { doSearch, SearchHit } from "../search/search";

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

    if (favoriteElements.length == 0) {
        return (
            <AppErrorState
                title="No favorites"
                icon="heart-broken"
                iconColor={Colors.RED3}
            />
        );
    }

    let filterResult;
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
            }
        );

        if (searchResults.hits.length === 0) {
            if (searchResults.filtered === 0) {
                return (
                    <AppErrorState
                        title="No favorites found"
                        icon="heart-broken"
                        iconColor={Colors.RED3}
                    />
                );
            }
            return (
                <AppErrorState
                    title="No favorites found."
                    description={`${searchResults.filtered} favorites are hidden by filters.`}
                    icon="heart-broken"
                    iconColor={Colors.RED3}
                    action={<ClearFiltersButton standardSize />}
                />
            );
        }

        filterResult = {
            elements: searchResults.hits
                .map((hit) => elements[hit.id])
                .filter((element) => !!element),
            filtered: searchResults.filtered
        };
        searchHits = searchResults.hits.reduce((acc, hit) => {
            acc[hit.id] = hit;
            return acc;
        }, {} as Record<string, SearchHit>);
    } else {
        filterResult = filterElements(favoriteElements, {
            vendors: uiState.vendorFilters,
            // Only elements which haven't been disabled can be shown
            isVisible: true
        });

        if (filterResult.elements.length == 0) {
            return (
                <AppErrorState
                    title="All favorites are hidden by filters"
                    icon="heart-broken"
                    iconColor={Colors.RED3}
                    action={<ClearFiltersButton standardSize />}
                />
            );
        }
    }

    let callout;
    if (filterResult.filtered > 0) {
        callout = (
            <Card className="item-card" style={{ padding: "0px" }}>
                <FilterCallout
                    itemType="favorites"
                    filteredItems={filterResult.filtered}
                />
            </Card>
        );
    }

    const cards = filterResult.elements.map((element: ElementObj) => {
        const favorite = userData.favorites[element.id];
        if (!favorite) {
            return null;
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

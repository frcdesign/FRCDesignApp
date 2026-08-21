import { Box } from "@mantine/core";
import { useAccessData } from "../../auth/access-level";
import { HeartBreak } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import { filterInsertables } from "../../search/filter";
import { getFavoriteForInsertable } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { useUiState } from "../../../lib/ui-state";
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
import { doSearch, FilterResult, SearchHit } from "../../search/search";
import { hasEditorAccess } from "@backend/features/auth/access-level";

/**
 * A list of current favorite cards.
 * Unlike the normal DocumentList, this list can be searched directly.
 */
export function FavoritesList(): ReactNode {
    const uiState = useUiState()[0];
    const accessData = useAccessData();

    const favoritesQuery = useFavoritesQuery();
    const libraryQuery = useLibraryQuery();
    const searchDbQuery = useSearchDbQuery();

    if (libraryQuery.isPending || favoritesQuery.isPending) {
        return <SectionLoading title="Loading favorites..." />;
    } else if (libraryQuery.isError || favoritesQuery.isError) {
        return (
            <SectionError
                title="Failed to load favorites."
                icon={
                    <Box
                        component={HeartBreak}
                        size={IconSize.SECTION}
                        c="red"
                    />
                }
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
        if (searchDbQuery.isLoading) {
            return <SectionLoading title="Searching..." />;
        } else if (searchDbQuery.isError) {
            return <SectionError title="Failed to load search database." />;
        } else if (!searchDbQuery.data) {
            return <SectionError title="The search database is empty." />;
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
            favoriteInsertableIds,
            hasEditorAccess(accessData.currentAccessLevel)
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
    if (filterResult.byGroup > 0 || filterResult.byVendor > 0) {
        callout = (
            <SearchCallout objectLabel="favorite" filtered={filterResult} />
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
            <ItemTable>{cards}</ItemTable>
        </>
    );
}

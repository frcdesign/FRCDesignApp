import MiniSearch, { Options } from "minisearch";
import { Favorite, InsertableOut } from "../../shared/api-models";
import { Vendor } from "../../shared/types";
import { tokenize, TypedMiniSearchResult } from "../../shared/search-utils";
import { processTerm } from "../../shared/search-utils";
import { Position, SearchHit } from "../search/insertable-search";

interface FavoriteSearchDocument {
    id: string;
    favoriteId: string;
    name: string;
    vendors: Vendor[];
}

type FavoriteSearchResult = TypedMiniSearchResult<FavoriteSearchDocument>;

const FAVORITE_SEARCH_OPTIONS: Options<FavoriteSearchDocument> = {
    fields: ["name"],
    storeFields: ["id", "name", "vendors"],
    searchOptions: {
        prefix: true
    },
    tokenize,
    processTerm
};

function getFavoriteSearchName(
    favorite: Favorite,
    insertables?: Record<string, InsertableOut>
): string {
    if (favorite.name) {
        return favorite.name;
    }

    const insertable = insertables?.[favorite.insertableId];
    return insertable?.name ?? "";
}

function buildFavoriteSearchDb(
    favorites: Favorite[],
    insertables?: Record<string, InsertableOut>
): MiniSearch<FavoriteSearchDocument> {
    const searchDb = new MiniSearch<FavoriteSearchDocument>(
        FAVORITE_SEARCH_OPTIONS
    );

    searchDb.addAll(
        favorites.map((favorite) => ({
            id: favorite.id,
            favoriteId: favorite.id,
            name: getFavoriteSearchName(favorite, insertables),
            vendors: insertables?.[favorite.insertableId]?.vendors ?? []
        }))
    );

    return searchDb;
}

function generateHighlightPositions(result: FavoriteSearchResult): Position[] {
    const name = result.name.toLowerCase();
    const positions: Position[] = [];

    for (const [term, matchedFields] of Object.entries(result.match)) {
        if (!matchedFields.includes("name")) {
            continue;
        }
        const matchedLocations = name.matchAll(new RegExp(`(${term})`, "gi"));
        for (const match of matchedLocations) {
            positions.push({
                start: match.index ?? 0,
                length: term.length
            });
        }
    }

    return positions;
}

export interface FilteredFavoritesResult {
    favorite: Favorite;
    searchHit: SearchHit | undefined;
    vendors: Vendor[];
}

export function filterFavoritesForSearch(
    favorites: Favorite[],
    query?: string,
    insertables?: Record<string, InsertableOut>,
    vendors?: Vendor[]
): FilteredFavoritesResult[] {
    if (!query || query.trim() === "") {
        return favorites.map((favorite) => ({
            favorite,
            searchHit: undefined,
            vendors: insertables?.[favorite.insertableId]?.vendors ?? []
        }));
    }

    const searchDb = buildFavoriteSearchDb(favorites, insertables);
    const miniSearchResults = searchDb.search(query, {
        filter: (result) => {
            const searchResult = result as FavoriteSearchResult;
            if (!vendors || vendors.length === 0) {
                return true;
            }
            const vendorSet = new Set(vendors);
            return searchResult.vendors.some((vendor) => vendorSet.has(vendor));
        }
    }) as FavoriteSearchResult[];

    const resultsById = new Map<string, FilteredFavoritesResult>();

    for (const miniSearchResult of miniSearchResults) {
        const favorite = favorites.find(
            (item) => item.id === miniSearchResult.id
        );
        if (!favorite) {
            continue;
        }

        resultsById.set(favorite.id, {
            favorite,
            searchHit: {
                id: favorite.id,
                positions: generateHighlightPositions(miniSearchResult)
            },
            vendors: miniSearchResult.vendors
        });
    }

    const queryText = query.trim().toLowerCase();
    for (const favorite of favorites) {
        const matchesId = favorite.id.toLowerCase().includes(queryText);
        if (!matchesId) {
            continue;
        }

        const insertable = insertables?.[favorite.insertableId];
        const vendorList = insertable?.vendors ?? [];
        if (vendors && vendors.length > 0) {
            const vendorSet = new Set(vendors);
            if (!vendorList.some((vendor) => vendorSet.has(vendor))) {
                continue;
            }
        }

        if (!resultsById.has(favorite.id)) {
            resultsById.set(favorite.id, {
                favorite,
                searchHit: {
                    id: favorite.id,
                    positions: []
                },
                vendors: vendorList
            });
        }
    }

    return Array.from(resultsById.values());
}

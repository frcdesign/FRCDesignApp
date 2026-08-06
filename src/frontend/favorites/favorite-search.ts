import MiniSearch, { Options } from "minisearch";
import { Favorite } from "../../shared/api-models";
import { tokenize, TypedMiniSearchResult } from "../../shared/search-utils";
import { processTerm } from "../../shared/search-utils";
import { Position, SearchHit } from "../search/insertable-search";

interface FavoriteSearchDocument {
    id: string;
    name: string;
}

type FavoriteSearchResult = TypedMiniSearchResult<FavoriteSearchDocument>;

const FAVORITE_SEARCH_OPTIONS: Options<FavoriteSearchDocument> = {
    fields: ["name", "favoriteId"],
    storeFields: ["id", "name"],
    searchOptions: {
        prefix: true
    },
    tokenize,
    processTerm
};

function buildFavoriteSearchDb(
    favorites: Favorite[]
): MiniSearch<FavoriteSearchDocument> {
    const searchDb = new MiniSearch<FavoriteSearchDocument>(
        FAVORITE_SEARCH_OPTIONS
    );

    searchDb.addAll(
        favorites.map((favorite) => ({
            id: favorite.id,
            name: favorite.name ?? ""
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
}

export function filterFavoritesForSearch(
    favorites: Favorite[],
    query?: string
): FilteredFavoritesResult[] {
    if (!query || query.trim() === "") {
        return favorites.map((favorite) => ({
            favorite,
            searchHit: undefined
        }));
    }

    const searchDb = buildFavoriteSearchDb(favorites);
    const miniSearchResults = searchDb.search(query, {
        filter: () => {
            // const searchResult = result as FavoriteSearchResult;
            return true;
        }
    }) as FavoriteSearchResult[];

    const results: FilteredFavoritesResult[] = [];

    for (const miniSearchResult of miniSearchResults) {
        const favorite = favorites.find(
            (item) => item.id === miniSearchResult.id
        );
        if (!favorite) {
            continue;
        }

        results.push({
            favorite,
            searchHit: {
                id: favorite.id,
                positions: generateHighlightPositions(miniSearchResult)
            }
        });
    }

    return results;
}

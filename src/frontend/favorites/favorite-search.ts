import MiniSearch, {
    Options,
    SearchResult as MiniSearchResult
} from "minisearch";
import { Favorite } from "../../shared/api-models";
import { processTerm, tokenize } from "../../shared/search";
import { Position, SearchHit } from "../search/search";

interface FavoriteSearchDocument {
    id: string;
    name: string;
    favoriteId: string;
}

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
            name: favorite.name ?? "",
            favoriteId: favorite.id
        }))
    );

    return searchDb;
}

function generateHighlightPositions(
    result: MiniSearchResult,
    document: FavoriteSearchDocument
): Position[] {
    const name = document.name.toLowerCase();
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

export interface FavoriteSearchResult {
    favorite: Favorite;
    searchHit: SearchHit | undefined;
}

export function filterFavoritesForSearch(
    favorites: Favorite[],
    query?: string
): FavoriteSearchResult[] {
    if (!query || query.trim() === "") {
        return favorites.map((favorite) => ({
            favorite,
            searchHit: undefined
        }));
    }

    const searchDb = buildFavoriteSearchDb(favorites);
    const miniSearchResults = searchDb.search(query);

    const results: FavoriteSearchResult[] = [];

    for (const miniSearchResult of miniSearchResults) {
        const document = searchDb.getStoredFields(
            miniSearchResult.id
        ) as unknown as FavoriteSearchDocument;
        const favorite = favorites.find((item) => item.id === document.id);
        if (!favorite) {
            continue;
        }

        results.push({
            favorite,
            searchHit: {
                id: favorite.id,
                positions: generateHighlightPositions(
                    miniSearchResult,
                    document
                )
            }
        });
    }

    return results;
}

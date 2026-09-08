import { ConfigurationKey, Selection } from "../configurations/models";
import { LibraryId } from "../library/library-id";

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    /** The selection it opens with; absent for the element's own defaults. */
    defaultSelection?: Selection;
    /** That selection's key, which names its thumbnail. Derived per response:
     * a reload moves the defaults, and a card has no parameters of its own. */
    configurationKey?: ConfigurationKey;
}

export interface FavoritesData {
    favorites: Record<string, Favorite>;
    favoriteOrder: string[];
}

export function getFavoriteForInsertable(
    favorites: Record<string, Favorite>,
    insertableId: string
): Favorite | undefined {
    for (const fav of Object.values(favorites)) {
        if (fav.insertableId === insertableId) return fav;
    }
    return undefined;
}

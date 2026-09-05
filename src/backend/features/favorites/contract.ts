import { ConfigurationKey, Selection } from "../configurations/models";
import { LibraryId } from "../library/library-id";

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    /** The selection it opens with; absent for the element's own defaults. */
    defaultSelection?: Selection;
    /**
     * That selection's key, which is what names its thumbnail. Derived per
     * response rather than stored, both because a reload can move the defaults
     * it is measured against and because a card has no parameters to derive it
     * from.
     */
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

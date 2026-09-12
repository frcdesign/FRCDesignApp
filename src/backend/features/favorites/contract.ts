import {
    ConfigurationKey,
    SearchRecord,
    Selection
} from "../configurations/contract";
import { LibraryId } from "../library/library-id";

/**
 * The most favorites one user may keep in one library. Far past what anyone
 * curates by hand, and low enough that reordering stays a single batch.
 */
export const MAX_FAVORITES = 250;

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    /** The selection it opens with; absent for the element's own defaults. */
    defaultSelection?: Selection;
    /** That selection's key, which names its thumbnail. Derived per response:
     * a reload moves the defaults, and a card has no parameters of its own. */
    configurationKey?: ConfigurationKey;
    /**
     * What that selection is called and numbered. Derived here for the same
     * reason as the key, and carried so a favorite row never has to read a part
     * number off anything but the configuration it was saved with.
     */
    record?: SearchRecord;
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

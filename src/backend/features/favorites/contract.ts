import {
    ConfigurationKey,
    SearchRecord,
    Selection
} from "../configurations/contract";
import { LibraryId } from "../library/library-id";

/** Low enough that reordering stays one batch. */
export const MAX_FAVORITES = 250;

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    /** The selection it opens with; absent for the element's own defaults. */
    defaultSelection?: Selection;
    /** Derived per response, since a reload can move the defaults. */
    configurationKey?: ConfigurationKey;
    /** Derived like the key, so the part number always matches the saved configuration. */
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

import { ParameterValues } from "../configurations/models";
import { LibraryId } from "../library/library-id";

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    /** The selection it opens with, as stored; absent for the element default. */
    defaultConfiguration?: ParameterValues;
    /**
     * That selection canonicalized against the insertable's parameters, which
     * is what names its thumbnail. Derived per response rather than stored, so
     * a reload that changes a parameter's default can't leave it stale.
     */
    canonicalConfiguration?: string;
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

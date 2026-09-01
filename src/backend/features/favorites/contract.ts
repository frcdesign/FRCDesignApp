import { LibraryId } from "../library/library-id";

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    /** The selection it opens with, canonical; absent for the element default. */
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

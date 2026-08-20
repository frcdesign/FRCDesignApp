import { ParameterValues } from "./configuration-models";
import { LibraryId } from "./library-id";

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
    defaultConfiguration?: ParameterValues;
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

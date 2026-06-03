import { ElementPath, InstancePath } from "./onshape-path";
import { Configuration } from "./configuration-models";
import { ElementType, Library, ThumbnailUrls, Vendor } from "./types";

export interface InsertableOut {
    id: string;
    elementId: string;
    documentId: string;
    instanceId: string;
    path: ElementPath;
    name: string;
    microversionId: string;
    versionName: string;
    versionCreatedAt: string;
    isVisible: boolean;
    isOpenComposite: boolean;
    supportsFasten: boolean;
    elementType: ElementType;
    thumbnailUrls: ThumbnailUrls;
    configurationId?: string;
    vendors: Vendor[];
}

export interface DocumentOut {
    id: string;
    path: InstancePath;
    name: string;
    sortAlphabetically: boolean;
    thumbnailUrls: ThumbnailUrls;
    insertableOrder: string[];
}

export type Insertables = Record<string, InsertableOut>;
export type Documents = Record<string, DocumentOut>;

export interface LibraryOut {
    documentOrder: string[];
    documents: Documents;
    insertables: Insertables;
}

export interface Favorite {
    id: string;
    insertableId: string;
    library: Library;
    defaultConfiguration?: Configuration;
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

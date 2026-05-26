import { ElementPath, InstancePath } from "./path";
import { Configuration } from "./configuration-models";
import { ElementType, Library, ThumbnailUrls, Vendor } from "./types";

export interface InsertableOut {
    id: string;
    elementId: string;
    documentId: string;
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
    library: Library;
    defaultConfiguration?: Configuration;
}

export type Favorites = Record<string, Favorite | undefined>;

export interface FavoritesData {
    favorites: Favorites;
    favoriteOrder: string[];
}

import { ElementPath, InstancePath } from "./onshape-path";
import { Configuration, ParameterObj } from "./configuration-models";
import { ElementType, LibraryId, ThumbnailUrls, Vendor } from "./types";
import { BuildIssue } from "./build-checker";

export interface InsertableOut {
    id: string;
    elementId: string;
    groupId: string;
    documentId: string;
    versionId: string;
    path: ElementPath;
    name: string;
    microversionId: string;
    isVisible: boolean;
    supportsFasten: boolean;
    elementType: ElementType;
    thumbnailUrls: ThumbnailUrls;
    configurationId?: string;
    vendors: Vendor[];
}

export interface GroupOut {
    id: string;
    documentId: string;
    path: InstancePath;
    name: string;
    thumbnailUrls: ThumbnailUrls;
    insertableOrder: string[];
}

export interface ConfigurationBuildStatus {
    buildIssues: BuildIssue[];
    parameters: ParameterObj[];
}

export interface GroupBuildStatus {
    buildIssues: BuildIssue[];
    sortAlphabetically: boolean;
    insertableOrder: string[];
}

export interface InsertableBuildStatus {
    buildIssues: BuildIssue[];
    isVisible: boolean;
    isOpenComposite: boolean;
    supportsFasten: boolean;
    vendors: Vendor[];
    configuration?: ConfigurationBuildStatus;
}

export interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
}

export type Insertables = Record<string, InsertableOut>;
export type Groups = Record<string, GroupOut>;

export interface LibraryOut {
    groupOrder: string[];
    groups: Groups;
    insertables: Insertables;
}

export interface Favorite {
    id: string;
    insertableId: string;
    libraryId: LibraryId;
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

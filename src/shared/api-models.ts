import { ElementPath, InstancePath } from "./onshape-path";
import {
    ParameterValues,
    ConfigurationParameter
} from "./configuration-models";
import { ElementType, LibraryId, ThumbnailUrls, Vendor } from "./types";
import { BuildIssue } from "./build-issues";

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
    thumbnailUrls?: ThumbnailUrls;
    configurationId?: string;
    vendors: Vendor[];
}

export interface GroupOut {
    id: string;
    documentId: string;
    path: InstancePath;
    name: string;
    thumbnailUrls?: ThumbnailUrls;
    insertableOrder: string[];
}

export interface ConfigurationBuildStatus {
    buildIssues: BuildIssue[];
    parameters: ConfigurationParameter[];
}

export interface GroupBuildStatus {
    buildIssues: BuildIssue[];
    sortAlphabetically: boolean;
    insertableOrder: string[];
    /** When this group was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
}

export interface InsertableBuildStatus {
    buildIssues: BuildIssue[];
    elementType: ElementType;
    isVisible: boolean;
    supportsFasten: boolean;
    forceIndex: boolean;
    vendors: Vendor[];
    configuration?: ConfigurationBuildStatus;
    /** When this insertable was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
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

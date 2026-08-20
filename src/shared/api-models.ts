import { ElementPath, InstancePath } from "./onshape-path";
import {
    ParameterValues,
    ConfigurationParameter
} from "./configuration-models";
import { ElementType, LibraryId, Vendor } from "./types";
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
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
    configurationId?: string;
    vendors: Vendor[];
}

export interface GroupOut {
    id: string;
    documentId: string;
    path: InstancePath;
    name: string;
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
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
    indexConfigurations: boolean;
    vendors: Vendor[];
    configuration?: ConfigurationBuildStatus;
    /** When this insertable was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
}

/** Whether a library-load job is running, and how long it has been going. */
/** Milliseconds since the oldest running job started paces the client's polling. */
export type JobStatus =
    | { running: false }
    | { running: true; runningForMs: number };

export interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
    /**
     * Whether a load job was running when this was fetched. Clients poll job
     * status only once this says there is something to watch, so an idle
     * library costs no polling at all.
     */
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

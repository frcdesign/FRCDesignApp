import {
    Library,
    Vendor,
    Theme,
    ElementType,
    ThumbnailSize
} from "../api-utils/client-models";

export enum MateLocation {
    FEATURE = "Feature",
    PART = "Part",
    SUBASSEMBLY = "Subassembly"
}

export interface VersionInfo {
    name: string;
    /** Firestore Timestamp — transform to Date in the application layer. */
    createdAt: FirebaseFirestore.Timestamp;
}

export interface FastenInfo {
    mateConnectorId: string;
    mateLocation: MateLocation;
    /** Instance IDs leading to the subassembly the mate connector lives in. */
    path: string[];
}

type ThumbnailUrls = Partial<Record<ThumbnailSize, string>>;

export interface LibraryData {
    cacheVersion: number;
    searchDb?: string;
    documentOrder: string[];
}

export interface DocumentData {
    /** Increment on breaking changes to the stored shape. */
    documentSchema: 1;
    name: string;
    /** Version ID of the document instance stored in this library. */
    instanceId: string;
    elementOrder: string[];
    sortAlphabetically: boolean;
    thumbnailUrls: ThumbnailUrls;
    versionInfo: VersionInfo;
}

export interface ElementData {
    elementSchema: 1;
    name: string;
    vendors: Vendor[];
    elementType: ElementType;
    /** ID of the parent Onshape document. */
    documentId: string;
    instanceId: string;
    microversionId: string;
    isVisible: boolean;
    isOpenComposite: boolean;
    fastenInfo?: FastenInfo;
    configurationId?: string;
    thumbnailUrls: ThumbnailUrls;
}

export interface LibraryUserData {
    favoriteOrder: string[];
}

export interface FavoriteData {
    defaultConfiguration?: Record<string, string>;
}

export interface Settings {
    theme: Theme;
    library: Library;
}

export interface UserData {
    settings: Settings;
}

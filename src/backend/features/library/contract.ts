import {
    DocumentPath,
    ElementPath,
    InstancePath
} from "../../lib/onshape/path";
import { ElementType } from "../../lib/onshape/element-type";
import { Vendor } from "./vendors";

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
    /** Whether an editor allowed replicating it onto several circular edges. */
    supportsReplicate: boolean;
    elementType: ElementType;
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
    /** Whether it has configuration parameters; they are fetched by `id`. */
    isConfigurable: boolean;
    vendors: Vendor[];
}

export interface GroupOut {
    id: string;
    documentId: string;
    /** Only a `DocumentPath` until a load pins a version to link to. */
    path: InstancePath | DocumentPath;
    name: string;
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
    /** False when no load has ever finished, i.e. the group is an empty shell. */
    isLoaded: boolean;
    insertableOrder: string[];
}

export type Insertables = Record<string, InsertableOut>;
export type Groups = Record<string, GroupOut>;

export interface InsertOut {
    /** The feature to open: the derive, or a fasten mate left for the caller to finish. */
    featureId?: string;
    /** How many circular edges the part was fastened to; absent when it was fastened to none. */
    fastenedCount?: number;
}

export interface LibraryOut {
    groupOrder: string[];
    groups: Groups;
    insertables: Insertables;
}

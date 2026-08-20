import { ElementPath, InstancePath } from "../../lib/onshape/path";
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

export type Insertables = Record<string, InsertableOut>;
export type Groups = Record<string, GroupOut>;

export interface LibraryOut {
    groupOrder: string[];
    groups: Groups;
    insertables: Insertables;
}

/**
 * Whether a library-load job is running, and how long it has been going.
 * Milliseconds since the oldest running job started paces the client's polling.
 */
export type JobStatus =
    | { running: false }
    | { running: true; runningForMs: number };

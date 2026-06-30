/**
 * Hand-authored types for the Onshape document + contents endpoints (the subset we
 * read). See `../generated` for the @hey-api reference slice. This module owns the raw
 * Onshape element/folder enums (the endpoint files re-export `OnshapeElementType`).
 */

/** Element (tab) types in a document (the Onshape `GBTElementType` values we handle). */
export enum OnshapeElementType {
    PART_STUDIO = "PARTSTUDIO",
    ASSEMBLY = "ASSEMBLY",
    DRAWING = "DRAWING",
    FEATURE_STUDIO = "FEATURESTUDIO",
    BLOB = "BLOB"
}

/** Discriminator (`btType`) of an entry in the document contents folder tree. */
export enum OnshapeFolderEntryType {
    GROUP = "BTElementGroup-1458",
    ELEMENT = "BTDocumentElementReference-2484"
}

/** GET /documents/{did} (only the fields we read). */
export interface OnshapeDocumentInfo {
    name: string;
    documentThumbnailElementId?: string;
}

/** A folder (group) node in the document contents tree. */
export interface OnshapeElementGroup {
    btType: OnshapeFolderEntryType.GROUP;
    /** Child folders and element references, in display order. */
    groups: OnshapeFolderEntry[];
}

/** A reference to an element (tab) within the contents tree. */
export interface OnshapeElementReference {
    btType: OnshapeFolderEntryType.ELEMENT;
    elementId: string;
}

export type OnshapeFolderEntry = OnshapeElementGroup | OnshapeElementReference;

/** An element (tab) listed in the document contents. */
export interface OnshapeDocumentElement {
    id: string;
    name: string;
    elementType: OnshapeElementType;
    microversionId: string;
}

/** GET /documents/d/{did}/{wvm}/{wvmid}/contents (the fields we read). */
export interface OnshapeDocumentContents {
    /** Root folder; its `groups` is the ordered folder/element tree. */
    folders: OnshapeElementGroup;
    /** Flat list of all elements (tabs) in the document. */
    elements: OnshapeDocumentElement[];
}

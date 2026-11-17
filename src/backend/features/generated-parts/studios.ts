/** Where a generated Part Studio is released: the tab a library loaded it from. A leaf module: the client reads it. */
export interface StudioLocation {
    documentId: string;
    versionId: string;
    elementId: string;
}

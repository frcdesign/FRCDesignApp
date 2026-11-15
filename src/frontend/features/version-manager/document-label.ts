/** A document as the Version Manager names it: Onshape's name, if it gave one. */
export function documentLabel(documentName: string | undefined): string {
    return documentName ?? "Untitled document";
}

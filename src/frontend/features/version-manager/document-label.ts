/** A document as the version manager names it: Onshape's name, if it gave one. */
export function documentLabel(documentName: string | undefined): string {
    return documentName ?? "Untitled document";
}

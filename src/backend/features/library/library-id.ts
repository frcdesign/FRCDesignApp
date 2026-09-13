export enum LibraryId {
    FRC_DESIGN_LIB = "frc-design-lib",
    FTC_DESIGN_LIB = "ftc-design-lib",
    MKCAD = "mkcad"
}

/**
 * A stored library id, or the default when it is not one the app still knows.
 * The column is plain text under its `$type`, so a row written before an id
 * changed — or by hand — reads back as something no route can render.
 */
export function toLibraryId(
    libraryId: string | undefined,
    fallback: LibraryId
): LibraryId {
    return Object.values(LibraryId).includes(libraryId as LibraryId)
        ? (libraryId as LibraryId)
        : fallback;
}

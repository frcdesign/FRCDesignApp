import { useParams } from "@tanstack/react-router";
import { LibraryId } from "@backend/features/library/library-id";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";

/** Returns the library being displayed, which the url is the source of truth for. */
export function useLibraryId(): LibraryId {
    // Callers can sit outside the library route — modals mount at the root and
    // error components replace the match — so fall back instead of throwing.
    const params = useParams({
        from: "/app/library/$libraryId",
        shouldThrow: false
    });
    return params?.libraryId ?? DEFAULT_SETTINGS.libraryId;
}

export function isLibraryId(libraryId: string): libraryId is LibraryId {
    return (Object.values(LibraryId) as string[]).includes(libraryId);
}

export function toLibraryPath(libraryId: LibraryId): string {
    return `/library/${libraryId}`;
}

export function toInsertablePath(insertableId: string): string {
    return `/insertable/${insertableId}`;
}

export function toGroupPath(groupId: string): string {
    return `/group/${groupId}`;
}

export function toFavoritePath(favoriteId: string): string {
    return `/favorite/${favoriteId}`;
}

export function getLibraryName(libraryId: string): string {
    switch (libraryId) {
        case LibraryId.FRC_DESIGN_LIB:
            return "FRCDesignLib";
        case LibraryId.FTC_DESIGN_LIB:
            return "FTCDesignLib (Beta)";
        case LibraryId.MKCAD:
            return "MKCAD (Deprecated)";
    }
    throw new Error("Unknown library: " + libraryId);
}

import { useMatch, useParams } from "@tanstack/react-router";
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
            return "FTCDesignLib";
        case LibraryId.MKCAD:
            return "MKCad";
    }
    throw new Error("Unknown library: " + libraryId);
}

/** The label on a library's tab, where there is only room for a few characters. */
export function getLibraryTabLabel(libraryId: string): string {
    switch (libraryId) {
        case LibraryId.FRC_DESIGN_LIB:
            return "FRC";
        case LibraryId.FTC_DESIGN_LIB:
            return "FTC";
        case LibraryId.MKCAD:
            return "MKCad";
    }
    throw new Error("Unknown library: " + libraryId);
}

export interface LibraryStatus {
    label: string;
    /** Mantine color for the badge; how much the label should alarm. */
    color: string;
}

/** Where a library is in its life; undefined once it is simply supported. */
export function getLibraryStatus(libraryId: string): LibraryStatus | undefined {
    switch (libraryId) {
        case LibraryId.FTC_DESIGN_LIB:
            return { label: "Beta", color: "blue" };
        case LibraryId.MKCAD:
            return { label: "Deprecated", color: "red" };
    }
    return undefined;
}

/** Whether the library's own page is showing, rather than one of its groups. */
export function useIsHome(): boolean {
    return (
        useMatch({
            from: "/app/library/$libraryId/",
            shouldThrow: false
        }) !== undefined
    );
}

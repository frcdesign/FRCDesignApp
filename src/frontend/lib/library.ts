/** Which library is being shown, and how each one is spelled to the user. */
import { notFound, useMatch, useParams } from "@tanstack/react-router";
import * as z from "zod";
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
    // The dashboard scopes to a library of its own, which its settings menu
    // offers the app for.
    const dashboardParams = useParams({
        from: "/dashboard/library/$libraryId",
        shouldThrow: false
    });
    return (
        params?.libraryId ??
        dashboardParams?.libraryId ??
        DEFAULT_SETTINGS.libraryId
    );
}

const LibraryIdType = z.enum(LibraryId);

/**
 * Reads the library id out of a url. An unknown one 404s here rather than
 * falling back, which would hide the bad url and strand the caller elsewhere.
 */
export function parseLibraryId(libraryId: string): LibraryId {
    const parsed = LibraryIdType.safeParse(libraryId);
    if (!parsed.success) {
        throw notFound();
    }
    return parsed.data;
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

/** Where a library is in its life; undefined once it is simply supported. */
export function getLibraryStatus(libraryId: string): string | undefined {
    switch (libraryId) {
        case LibraryId.MKCAD:
            return "Deprecated";
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

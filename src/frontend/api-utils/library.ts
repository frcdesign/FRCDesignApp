import { useLoaderData, useParams } from "@tanstack/react-router";
import { LibraryId } from "../../shared/types";

/** Returns the library being displayed, which the url is the source of truth for. */
export function useLibraryId(): LibraryId {
    return useParams({ from: "/app/library/$libraryId" }).libraryId;
}

/** The displayed library's cache version, which keys its immutable responses. */
export function useCacheVersion(): number {
    const libraryId = useLibraryId();
    return useLoaderData({ from: "/app" }).cacheVersions[libraryId] ?? 0;
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

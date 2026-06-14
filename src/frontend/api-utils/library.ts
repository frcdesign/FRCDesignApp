import { useLoaderData } from "@tanstack/react-router";
import { LibraryId } from "../../shared/types";

export function useLibraryId() {
    return useLoaderData({ from: "/app" }).settings.libraryId;
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

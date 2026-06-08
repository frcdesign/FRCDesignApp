import { useLoaderData } from "@tanstack/react-router";
import { Library } from "../../shared/types";

export function useLibrary() {
    return useLoaderData({ from: "/app" }).settings.library;
}

export function toLibraryPath(library: Library): string {
    return `/library/${library}`;
}

export function toInsertablePath(insertableId: string): string {
    return `/insertable/${insertableId}`;
}

export function getLibraryName(library: string): string {
    switch (library) {
        case Library.FRC_DESIGN_LIB:
            return "FRCDesignLib";
        case Library.FTC_DESIGN_LIB:
            return "FTCDesignLib";
        case Library.MKCAD:
            return "MKCAD (Deprecated)";
    }
    throw new Error("Unknown library: " + library);
}

import { Library } from "../../shared/types";
import { useSearch } from "@tanstack/react-router";

export function useLibrary() {
    return useSearch({ from: "/app" }).settings.library;
}

export function toLibraryPath(library: Library): string {
    return `/library/${library}`;
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

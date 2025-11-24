import { Library } from "./models";
import { useUserData } from "../queries";

export function useLibrary() {
    return useUserData().settings.library;
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

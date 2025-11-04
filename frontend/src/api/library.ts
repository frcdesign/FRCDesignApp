import { Library } from "./models";
import { useUserData } from "../queries";

export function useLibrary() {
    return useUserData().settings.library;
}

export function toLibraryPath(library: Library): string {
    return `/library/${library}`;
}

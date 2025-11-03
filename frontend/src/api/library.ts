import { useSearch } from "@tanstack/react-router";
import { Library } from "./models";

export function useLibrary() {
    return useSearch({ from: "/app" }).library;
}

export function toLibraryPath(library: Library): string {
    return `/library/${library}`;
}

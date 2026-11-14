/** Which library is being shown, and how each one is spelled to the user. */
import { createContext, use } from "react";
import { notFound, useMatch, useParams } from "@tanstack/react-router";
import * as z from "zod";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";

/** Points what reads the library at another than the one shown, as the admin settings do. */
export const LibraryIdOverride = createContext<LibraryId | undefined>(
    undefined
);

/** Falls back rather than throws, since modals and error components sit outside the library route. */
export function useLibraryId(): LibraryId {
    const override = use(LibraryIdOverride);
    const shown = useShownLibraryId();
    return override ?? shown ?? DEFAULT_LIBRARY;
}

/** The library the page shows; undefined on a tab that is not one. */
export function useShownLibraryId(): LibraryId | undefined {
    const params = useParams({
        from: "/app/library/$libraryId",
        shouldThrow: false
    });
    const dashboardParams = useParams({
        from: "/dashboard/library/$libraryId",
        shouldThrow: false
    });
    return params?.libraryId ?? dashboardParams?.libraryId;
}

const LibraryIdType = z.enum(LibraryId);

/** 404s an unknown id rather than hiding the bad url. */
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
        case LibraryId.CONFIG_LIB:
            return "ConfigLib";
        case LibraryId.MKCAD:
            return "MKCad";
    }
    throw new Error("Unknown library: " + libraryId);
}

/** The program a library's parts are for, which the page menu files it under. */
export function getLibraryProgram(libraryId: string): string {
    switch (libraryId) {
        case LibraryId.FRC_DESIGN_LIB:
        case LibraryId.MKCAD:
            return "FRC";
        case LibraryId.CONFIG_LIB:
            return "FTC";
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

export function useIsHome(): boolean {
    return (
        useMatch({
            from: "/app/library/$libraryId/",
            shouldThrow: false
        }) !== undefined
    );
}

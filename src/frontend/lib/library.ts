/** Which library is being shown, and how each one is spelled to the user. */
import { notFound, useMatch, useParams } from "@tanstack/react-router";
import * as z from "zod";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";
import { isLibraryTab } from "./app-tab";
import { getUiState } from "./ui-state";

/** Falls back rather than throws, since modals and error components sit outside the library route. */
export function useLibraryId(): LibraryId {
    const params = useParams({
        from: "/app/library/$libraryId",
        shouldThrow: false
    });
    const dashboardParams = useParams({
        from: "/dashboard/library/$libraryId",
        shouldThrow: false
    });
    return params?.libraryId ?? dashboardParams?.libraryId ?? DEFAULT_LIBRARY;
}

/** The library to show where the url names none: the last one picked. */
export function getUiLibraryId(): LibraryId {
    const { tabId } = getUiState();
    return tabId && isLibraryTab(tabId) ? tabId : DEFAULT_LIBRARY;
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

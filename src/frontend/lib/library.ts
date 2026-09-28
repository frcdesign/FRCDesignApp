/** Which library is being shown, and how each one is spelled to the user. */
import { notFound, useMatch, useParams } from "@tanstack/react-router";
import * as z from "zod";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";

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

export function useIsHome(): boolean {
    return (
        useMatch({
            from: "/app/library/$libraryId/",
            shouldThrow: false
        }) !== undefined
    );
}

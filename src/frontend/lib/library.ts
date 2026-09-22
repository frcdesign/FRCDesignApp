/** Which library is being shown, and how each one is spelled to the user. */
import { notFound, useMatch, useParams } from "@tanstack/react-router";
import * as z from "zod";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";
import { isLibraryTab } from "@backend/features/settings/app-tab";
import { useTabId } from "./tabs";

/**
 * Returns the library being displayed, which the url is the source of truth
 * for. Its callers are a library's own pages and the controls beside them, so
 * a tab that is not a library falls back as sitting outside the route does.
 */
export function useLibraryId(): LibraryId {
    const tabId = useTabId();
    // The dashboard scopes to a library of its own, which its settings menu
    // offers the app for.
    const dashboardParams = useParams({
        from: "/dashboard/library/$libraryId",
        shouldThrow: false
    });
    if (isLibraryTab(tabId)) {
        return tabId;
    }
    return dashboardParams?.libraryId ?? DEFAULT_LIBRARY;
}

const LibraryIdType = z.enum(LibraryId);

/**
 * Reads a library id out of a url — the dashboard's, which scopes to one
 * directly. An unknown one 404s here rather than falling back, which would
 * hide the bad url and strand the caller elsewhere.
 */
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

/** Whether the tab's own page is showing, rather than one of its groups. */
export function useIsHome(): boolean {
    return (
        useMatch({
            from: "/app/tab/$tabId/",
            shouldThrow: false
        }) !== undefined
    );
}

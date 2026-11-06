import { useMatch } from "@tanstack/react-router";
import { LibraryId } from "@backend/features/library/library-id";

export function useIsDashboard(): boolean {
    return useMatch({ from: "/dashboard", shouldThrow: false }) !== undefined;
}

/** The library a dashboard page reports on; undefined on the app dashboard. */
export function useDashboardLibraryId(): LibraryId | undefined {
    return useMatch({
        from: "/dashboard/library/$libraryId",
        shouldThrow: false
    })?.params.libraryId;
}

/** The dashboards reachable from the navbar. */
export type DashboardKey = "app" | "library" | "unused" | "part";

interface DashboardDefinition {
    key: DashboardKey;
    label: string;
    /** The route path; library-scoped ones take a `libraryId` param. */
    to: string;
    /** False for the app dashboard, which spans every library. */
    needsLibrary: boolean;
}

export const DASHBOARDS: DashboardDefinition[] = [
    {
        key: "app",
        label: "App dashboard",
        to: "/dashboard",
        needsLibrary: false
    },
    {
        key: "library",
        label: "Library dashboard",
        to: "/dashboard/library/$libraryId",
        needsLibrary: true
    },
    {
        key: "unused",
        label: "Low usage dashboard",
        to: "/dashboard/library/$libraryId/unused",
        needsLibrary: true
    },
    {
        key: "part",
        label: "Part dashboard",
        to: "/dashboard/library/$libraryId/part",
        needsLibrary: true
    }
];

/** One part's report, as a row of the dashboard's tables navigates to it. */
export function partDashboardLocation(libraryId: LibraryId, elementId: string) {
    return {
        to: "/dashboard/library/$libraryId/part",
        params: { libraryId },
        search: { element: elementId }
    } as const;
}

/** The same report as a url, for a link that opens it in a new tab. */
export function partDashboardUrl(
    libraryId: LibraryId,
    elementId: string
): string {
    const { to, params, search } = partDashboardLocation(libraryId, elementId);
    const path = to.replace("$libraryId", params.libraryId);
    return `${path}?${new URLSearchParams(search).toString()}`;
}

/** A library's dashboard as a url, for a link that opens it in a new tab. */
export function libraryDashboardUrl(libraryId: LibraryId): string {
    return `/dashboard/library/${libraryId}`;
}

/** The library a scoped dashboard falls back to when none is selected yet. */
export const DEFAULT_LIBRARY = LibraryId.FRC_DESIGN_LIB;

/** The uses a part must be at or below before the low-usage dashboard lists it. */
export const DEFAULT_THRESHOLD = 5;

/** Which dashboard a path belongs to, for highlighting the current one. */
export function toDashboardKey(pathname: string): DashboardKey {
    if (pathname.endsWith("/unused")) return "unused";
    if (pathname.endsWith("/part")) return "part";
    if (pathname.includes("/library/")) return "library";
    return "app";
}

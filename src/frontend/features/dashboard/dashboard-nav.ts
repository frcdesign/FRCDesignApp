import { LibraryId } from "@backend/features/library/library-id";

/** The dashboards reachable from the navbar. */
export type DashboardKey = "app" | "library" | "unused" | "part";

export interface DashboardDefinition {
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
        label: "App",
        to: "/dashboard",
        needsLibrary: false
    },
    {
        key: "library",
        label: "Library",
        to: "/dashboard/library/$libraryId",
        needsLibrary: true
    },
    {
        key: "unused",
        label: "Unused parts",
        to: "/dashboard/library/$libraryId/unused",
        needsLibrary: true
    },
    {
        key: "part",
        label: "Part report",
        to: "/dashboard/library/$libraryId/part",
        needsLibrary: true
    }
];

/** The library a scoped dashboard falls back to when none is selected yet. */
export const DEFAULT_LIBRARY = LibraryId.FRC_DESIGN_LIB;

/** Which dashboard a path belongs to, for highlighting the current one. */
export function toDashboardKey(pathname: string): DashboardKey {
    if (pathname.endsWith("/unused")) return "unused";
    if (pathname.endsWith("/part")) return "part";
    if (pathname.includes("/library/")) return "library";
    return "app";
}

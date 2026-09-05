import { Container } from "@mantine/core";
import {
    createFileRoute,
    Outlet,
    retainSearchParams
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { DashboardNavbar } from "../../features/dashboard/dashboard-navbar";
import {
    isRangePreset,
    type RangePreset
} from "../../features/dashboard/range";

export interface DashboardSearch {
    /** Preset window for the range chart; kept in the URL so views are shareable. */
    range?: RangePreset;
    /** The uses a part must be at or below to count as low usage. */
    threshold?: number;
}

export const Route = createFileRoute("/dashboard")({
    component: DashboardLayout,
    validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
        range: isRangePreset(search.range) ? search.range : undefined,
        threshold:
            typeof search.threshold === "number" && search.threshold >= 0
                ? search.threshold
                : undefined
    }),
    search: {
        middlewares: [retainSearchParams(["range", "threshold"])]
    }
});

/**
 * The dashboard is a sibling of `/app`, so it inherits none of the Onshape
 * panel's shell or authed loaders — it is a full-screen public page.
 */
function DashboardLayout(): ReactNode {
    return (
        <>
            <DashboardNavbar />
            <Container size="xl" py="xl">
                <Outlet />
            </Container>
        </>
    );
}

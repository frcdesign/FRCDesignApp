import { Container } from "@mantine/core";
import {
    createFileRoute,
    Outlet,
    retainSearchParams
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import * as z from "zod";
import { DashboardNavbar } from "../../features/dashboard/dashboard-navbar";
import { RangePreset } from "../../features/dashboard/range";
import { parseSearch } from "../../lib/search-params";

// Every field is caught rather than required: a hand-edited url should drop the
// bad param, not fail the whole route.
const DashboardSearchType = z.object({
    /** Preset window for the range chart; kept in the URL so views are shareable. */
    range: z.enum(RangePreset).optional().catch(undefined),
    /** The uses a part must be at or below to count as low usage. */
    threshold: z.coerce.number().int().nonnegative().optional().catch(undefined)
});

type DashboardSearch = z.infer<typeof DashboardSearchType>;

export const Route = createFileRoute("/dashboard")({
    component: DashboardLayout,
    validateSearch: (search: Record<string, unknown>): DashboardSearch =>
        parseSearch(DashboardSearchType, search),
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

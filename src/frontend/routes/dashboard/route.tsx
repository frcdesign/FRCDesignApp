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

// Caught, so a hand-edited url drops the bad param instead of failing.
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

/** A sibling of `/app`, so it's a public full-screen page without the panel's shell. */
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

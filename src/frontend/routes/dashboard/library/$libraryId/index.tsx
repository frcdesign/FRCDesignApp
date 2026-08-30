import { Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
    getHealthQuery,
    getLibrarySummaryQuery,
    getPartsQuery
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { HealthTiles } from "../../../../features/dashboard/health-report";
import { InsertsOverTimeCard } from "../../../../features/dashboard/inserts-chart";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import { toDayRange } from "../../../../features/dashboard/range";
import { useRangePreset } from "../../../../features/dashboard/range-control";
import {
    libraryRoot,
    UsageTreemap
} from "../../../../features/dashboard/usage-treemap";
import { LifetimeTiles } from "../../../../features/dashboard/lifetime-tiles";
import { SectionCard } from "../../../../features/dashboard/section";

/** Enough to see the head of the distribution without a wall of rows. */
const MOST_USED_LIMIT = 10;

export const Route = createFileRoute("/dashboard/library/$libraryId/")({
    component: LibraryOverview
});

function LibraryOverview(): ReactNode {
    const { libraryId } = Route.useParams();
    const preset = useRangePreset();

    const range = toDayRange(preset);

    const summary = useQuery(getLibrarySummaryQuery(libraryId, range));
    const parts = useQuery(getPartsQuery(libraryId, range));
    const health = useQuery(getHealthQuery(libraryId));

    if (!summary.data) {
        return <DashboardState query={summary} />;
    }
    const { totals, metricSeries, growth } = summary.data;

    return (
        <Stack gap="xl">
            <LifetimeTiles
                totals={totals}
                growth={growth}
                series={metricSeries}
            />

            <InsertsOverTimeCard series={metricSeries} libraryId={libraryId} />

            <SectionCard title="Most used parts">
                {parts.data ? (
                    <PartsTable
                        libraryId={libraryId}
                        // Now that unused parts are included, this would
                        // otherwise trail off into a list of zeroes.
                        parts={parts.data.slice(0, MOST_USED_LIMIT)}
                        emptyMessage="No parts have been inserted from this library yet."
                    />
                ) : (
                    <DashboardState query={parts} />
                )}
            </SectionCard>

            {health.data ? (
                <HealthTiles counts={health.data} />
            ) : (
                <DashboardState query={health} />
            )}

            {parts.data ? (
                /* Keyed so switching library drops a zoom into a group that
                   the next library does not have. */
                <UsageTreemap
                    key={libraryId}
                    root={libraryRoot(libraryId)}
                    parts={parts.data.map((part) => ({ ...part, libraryId }))}
                />
            ) : (
                <DashboardState query={parts} />
            )}
        </Stack>
    );
}

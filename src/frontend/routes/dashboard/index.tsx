import { Card, SimpleGrid, Stack } from "@mantine/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { type DayRange } from "@backend/features/analytics/day";
import {
    getOverviewQuery,
    getPartsQuery
} from "../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../features/dashboard/dashboard-state";
import { InsertsByLibraryCard } from "../../features/dashboard/inserts-chart";
import { InsertSourceBreakdown } from "../../features/dashboard/insert-mix";
import { RangePreset, toDayRange } from "../../features/dashboard/range";
import { RecentSection } from "../../features/dashboard/growth-section";
import { HeadlineTiles } from "../../features/dashboard/headline-tiles";
import { METRICS } from "../../features/dashboard/metrics";
import { Section } from "../../components/section";
import { UsageTreemap } from "../../features/dashboard/usage-treemap";
import { TrendTile } from "../../features/dashboard/trend-tile";

export const Route = createFileRoute("/dashboard/")({
    component: DashboardOverview
});

/** Every library's parts, so the treemap can start above all of them. */
function useAllParts(range: DayRange) {
    return useQueries({
        queries: Object.values(LibraryId).map((libraryId) =>
            getPartsQuery(libraryId, range)
        )
    });
}

function DashboardOverview(): ReactNode {
    // No range picker: each section names its own window.
    const range = toDayRange(RangePreset.ALL);
    const query = useQuery(getOverviewQuery(range));
    const allParts = useAllParts(range);

    if (!query.data) {
        return <DashboardState query={query} />;
    }
    const { totals, series, metricSeries, sources, growth } = query.data;

    return (
        <Stack gap="xl">
            <Section title="Overall">
                <HeadlineTiles
                    totals={totals}
                    growth={growth}
                    series={metricSeries}
                    withOpens
                />
            </Section>

            <RecentSection growth={growth} series={metricSeries} />

            <InsertsByLibraryCard series={series} />

            <Section title="How people use the app">
                <Card>
                    <InsertSourceBreakdown sources={sources} />
                </Card>
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TrendTile
                        metric={METRICS.quickFraction}
                        totals={totals}
                        series={metricSeries}
                    />
                    <TrendTile
                        metric={METRICS.fastenFraction}
                        totals={totals}
                        series={metricSeries}
                    />
                    <TrendTile
                        metric={METRICS.assemblyFraction}
                        totals={totals}
                        series={metricSeries}
                    />
                </SimpleGrid>
            </Section>

            {allParts.every((query) => query.data) ? (
                <UsageTreemap
                    parts={allParts.flatMap((query) => query.data ?? [])}
                />
            ) : (
                <DashboardState query={allParts[0]} />
            )}
        </Stack>
    );
}

import { Card, SimpleGrid, Stack } from "@mantine/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import {
    getOverviewQuery,
    getPartsQuery,
    type DayRange
} from "../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../features/dashboard/dashboard-state";
import { InsertsByLibraryCard } from "../../features/dashboard/inserts-chart";
import { InsertSourceBreakdown } from "../../features/dashboard/insert-mix";
import { RangePreset, toDayRange } from "../../features/dashboard/range";
import { RecentSection } from "../../features/dashboard/growth-section";
import { LifetimeTiles } from "../../features/dashboard/lifetime-tiles";
import { METRICS } from "../../features/dashboard/metrics";
import { Section } from "../../components/section";
import { UsageTreemap } from "../../features/dashboard/usage-treemap";
import { type UsagePart } from "../../features/dashboard/treemap-data";
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

/** Tags a library's parts with which library they came from. */
function taggedParts(
    query: { data?: PartUsageOut[] },
    index: number
): UsagePart[] {
    const libraryId = Object.values(LibraryId)[index];
    return (query.data ?? []).map((part) => ({ ...part, libraryId }));
}

function DashboardOverview(): ReactNode {
    // No range picker: each section names the window it reports, which is how
    // one page mixes a trailing month, a season and all time.
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
                <LifetimeTiles
                    totals={totals}
                    growth={growth}
                    series={metricSeries}
                    withOpens
                />
            </Section>

            <RecentSection growth={growth} series={metricSeries} />

            <InsertsByLibraryCard series={series} />

            <Section title="How people use the app">
                <Card withBorder padding="lg" radius="md">
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
                <UsageTreemap parts={allParts.flatMap(taggedParts)} />
            ) : (
                <DashboardState query={allParts[0]} />
            )}
        </Stack>
    );
}

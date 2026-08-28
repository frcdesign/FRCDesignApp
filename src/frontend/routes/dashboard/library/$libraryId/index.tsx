import { SimpleGrid, Stack } from "@mantine/core";
import { ChartPieSlice, Star } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
    getHealthQuery,
    getLibrarySummaryQuery,
    getPartsQuery
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import {
    HealthItemsTable,
    HealthTiles,
    IssueBreakdown
} from "../../../../features/dashboard/health-report";
import { InsertsOverTimeCard } from "../../../../features/dashboard/inserts-chart";
import { InsertSourceBreakdown } from "../../../../features/dashboard/insert-mix";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import {
    RANGE_PRESETS,
    toDayRange
} from "../../../../features/dashboard/range";
import { useRangePreset } from "../../../../features/dashboard/range-control";
import { formatPercent } from "../../../../features/dashboard/series-utils";
import { RecentSection } from "../../../../features/dashboard/growth-section";
import { LifetimeTiles } from "../../../../features/dashboard/lifetime-tiles";
import { METRICS } from "../../../../features/dashboard/metrics";
import { Section, SectionCard } from "../../../../features/dashboard/section";
import { StatTile } from "../../../../features/dashboard/stat-tiles";
import { TrendTile } from "../../../../features/dashboard/trend-tile";

/** Enough to see the head of the distribution without a wall of rows. */
const MOST_USED_LIMIT = 10;

export const Route = createFileRoute("/dashboard/library/$libraryId/")({
    component: LibraryOverview
});

function LibraryOverview(): ReactNode {
    const { libraryId } = Route.useParams();
    const preset = useRangePreset();
    const window = RANGE_PRESETS[preset].label;

    const summary = useQuery(
        getLibrarySummaryQuery(libraryId, toDayRange(preset))
    );
    const parts = useQuery(getPartsQuery(libraryId));
    const health = useQuery(getHealthQuery(libraryId));

    if (!summary.data) {
        return <DashboardState query={summary} />;
    }
    const { totals, metricSeries, sources, growth, appInserts } = summary.data;

    return (
        <Stack gap="xl">
            <Section title="Overall" window="All time">
                <LifetimeTiles totals={totals} growth={growth} />
            </Section>

            <RecentSection growth={growth} />

            <Section title="Usage" window={window}>
                {/* Total uses is not repeated here: the Overall card above
                    carries it, and the chart below draws its trend full size. */}
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TrendTile
                        metric={METRICS.activeUsers}
                        totals={totals}
                        series={metricSeries}
                    />
                    {/* Lifetime on both sides, so a library's place among the
                        others does not move when the range does. */}
                    <StatTile
                        label="Share of all uses"
                        value={formatPercent(totals.inserts, appInserts)}
                        icon={ChartPieSlice}
                    />
                    <StatTile
                        label="Favorites"
                        value={totals.favorites}
                        icon={Star}
                    />
                </SimpleGrid>
            </Section>

            <InsertsOverTimeCard
                series={metricSeries}
                libraryId={libraryId}
                window={window}
            />

            <SectionCard title="How parts are found here" window={window}>
                <InsertSourceBreakdown sources={sources} />
                <SimpleGrid cols={{ base: 1, sm: 2 }} mt="lg">
                    <TrendTile
                        metric={METRICS.deriveShare}
                        totals={totals}
                        series={metricSeries}
                    />
                </SimpleGrid>
            </SectionCard>

            <SectionCard title="Most used parts" window="All time">
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

            <Section title="Build status" window="Right now">
                {health.data ? (
                    <>
                        <HealthTiles counts={health.data.counts} />

                        <SectionCard title="Issues by kind">
                            <IssueBreakdown issues={health.data.issues} />
                        </SectionCard>

                        <SectionCard title="What needs attention">
                            <HealthItemsTable items={health.data.items} />
                        </SectionCard>
                    </>
                ) : (
                    <DashboardState query={health} />
                )}
            </Section>
        </Stack>
    );
}

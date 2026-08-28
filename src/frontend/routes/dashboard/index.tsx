import { SimpleGrid, Stack, Table } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { getLibraryName } from "../../features/library/library-path";
import { DashboardLink } from "../../features/dashboard/dashboard-link";
import { getOverviewQuery } from "../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../features/dashboard/dashboard-state";
import { LibraryHealthStrip } from "../../features/dashboard/health-report";
import { InsertsByLibraryCard } from "../../features/dashboard/inserts-chart";
import { InsertSourceBreakdown } from "../../features/dashboard/insert-mix";
import { toDayRange } from "../../features/dashboard/range";
import {
    formatCount,
    formatPercent
} from "../../features/dashboard/series-utils";
import { RecentSection } from "../../features/dashboard/growth-section";
import { LifetimeTiles } from "../../features/dashboard/lifetime-tiles";
import { METRICS } from "../../features/dashboard/metrics";
import { Section, SectionCard } from "../../features/dashboard/section";
import { TrendTile } from "../../features/dashboard/trend-tile";

export const Route = createFileRoute("/dashboard/")({
    component: DashboardOverview
});

function DashboardOverview(): ReactNode {
    // No range picker here: each section is opinionated about the window it
    // reports on and says so, which is the only way one page can mix a trailing
    // month, a season and all time without the reader having to guess.
    const query = useQuery(getOverviewQuery(toDayRange("all")));

    if (!query.data) {
        return <DashboardState query={query} />;
    }
    const { totals, libraries, series, metricSeries, sources, growth } =
        query.data;

    return (
        <Stack gap="xl">
            <Section title="Overall" window="All time">
                <LifetimeTiles totals={totals} growth={growth} withOpens />
            </Section>

            <RecentSection growth={growth} withOpens />

            <InsertsByLibraryCard series={series} />

            <SectionCard title="How people use the app" window="All time">
                <InsertSourceBreakdown sources={sources} />
                <SimpleGrid cols={{ base: 1, sm: 3 }} mt="lg">
                    <TrendTile
                        metric={METRICS.quickShare}
                        totals={totals}
                        series={metricSeries}
                    />
                    <TrendTile
                        metric={METRICS.fastenShare}
                        totals={totals}
                        series={metricSeries}
                    />
                    <TrendTile
                        metric={METRICS.deriveShare}
                        totals={totals}
                        series={metricSeries}
                    />
                </SimpleGrid>
            </SectionCard>

            <Section title="Libraries" window="All time">
                {/* A person active in two libraries has a row in each, so
                    the user column deliberately does not sum to the app
                    total. */}
                <SectionCard title="Usage">
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Library</Table.Th>
                                <Table.Th ta="right">Total uses</Table.Th>
                                <Table.Th ta="right">Share</Table.Th>
                                <Table.Th ta="right">Unique users</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {libraries.map(({ libraryId, totals: row }) => (
                                <Table.Tr key={libraryId}>
                                    <Table.Td>
                                        <DashboardLink
                                            to="/dashboard/library/$libraryId"
                                            params={{ libraryId }}
                                        >
                                            {getLibraryName(libraryId)}
                                        </DashboardLink>
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.inserts)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatPercent(
                                            row.inserts,
                                            totals.inserts
                                        )}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.uniqueUsers)}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </SectionCard>
                <SectionCard title="Build health" window="Right now">
                    <LibraryHealthStrip libraries={libraries} />
                </SectionCard>
            </Section>
        </Stack>
    );
}

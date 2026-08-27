import { Card, Group, Stack, Table, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { getLibraryName } from "../../features/library/library-path";
import { DashboardLink } from "../../features/dashboard/dashboard-link";
import { getOverviewQuery } from "../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../features/dashboard/dashboard-state";
import { HealthSummary } from "../../features/dashboard/health-report";
import { InsertSourceBreakdown } from "../../features/dashboard/insert-mix";
import { toDayRange } from "../../features/dashboard/range";
import {
    RangeControl,
    useRangePreset
} from "../../features/dashboard/range-control";
import { formatCount } from "../../features/dashboard/series-utils";
import { TrendTiles } from "../../features/dashboard/trend-tiles";

export const Route = createFileRoute("/dashboard/")({
    component: DashboardOverview
});

function DashboardOverview(): ReactNode {
    const preset = useRangePreset();
    const query = useQuery(getOverviewQuery(toDayRange(preset)));

    if (!query.data) {
        return <DashboardState query={query} />;
    }
    const { totals, libraries, series, metricSeries, sources } = query.data;

    return (
        <Stack gap="xl">
            <Group justify="space-between">
                <Title order={3}>All libraries</Title>
                <RangeControl />
            </Group>

            <TrendTiles
                totals={totals}
                series={metricSeries}
                librarySeries={series}
            />

            <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                    Where inserts start
                </Title>
                <InsertSourceBreakdown sources={sources} />
            </Card>

            <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                    Libraries
                </Title>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Library</Table.Th>
                            <Table.Th ta="right">Total uses</Table.Th>
                            <Table.Th ta="right">App opens</Table.Th>
                            <Table.Th ta="right">Unique users</Table.Th>
                            <Table.Th ta="right">Build issues</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {libraries.map(
                            ({ libraryId, rangeTotals: row, health }) => (
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
                                        {formatCount(row.appOpens)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        {formatCount(row.uniqueUsers)}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                        <HealthSummary health={health} />
                                    </Table.Td>
                                </Table.Tr>
                            )
                        )}
                    </Table.Tbody>
                </Table>
            </Card>
        </Stack>
    );
}

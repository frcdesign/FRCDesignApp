import { Card, Group, Stack, Title } from "@mantine/core";
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
import { InsertSourceBreakdown } from "../../../../features/dashboard/insert-mix";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import { toDayRange } from "../../../../features/dashboard/range";
import {
    RangeControl,
    useRangePreset
} from "../../../../features/dashboard/range-control";
import { TrendTiles } from "../../../../features/dashboard/trend-tiles";

/** Enough to see the head of the distribution without a wall of rows. */
const MOST_USED_LIMIT = 10;

export const Route = createFileRoute("/dashboard/library/$libraryId/")({
    component: LibraryOverview
});

function LibraryOverview(): ReactNode {
    const { libraryId } = Route.useParams();
    const preset = useRangePreset();

    const summary = useQuery(
        getLibrarySummaryQuery(libraryId, toDayRange(preset))
    );
    const parts = useQuery(getPartsQuery(libraryId));
    const health = useQuery(getHealthQuery(libraryId));

    if (!summary.data) {
        return <DashboardState query={summary} />;
    }

    return (
        <Stack gap="xl">
            <Group justify="flex-end">
                <RangeControl />
            </Group>

            <TrendTiles
                totals={summary.data.totals}
                series={summary.data.metricSeries}
                scopedToLibrary
            />

            <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                    Where inserts start
                </Title>
                <InsertSourceBreakdown sources={summary.data.sources} />
            </Card>

            <Title order={3}>Build status</Title>
            {health.data ? (
                <>
                    <HealthTiles counts={health.data.counts} />

                    <Card withBorder padding="lg" radius="md">
                        <Title order={4} mb="md">
                            Issues by kind
                        </Title>
                        <IssueBreakdown issues={health.data.issues} />
                    </Card>

                    <Card withBorder padding="lg" radius="md">
                        <Title order={4} mb="md">
                            What needs attention
                        </Title>
                        <HealthItemsTable items={health.data.items} />
                    </Card>
                </>
            ) : (
                <DashboardState query={health} />
            )}

            <Card withBorder padding="lg" radius="md">
                <Title order={4} mb="md">
                    Most used parts
                </Title>
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
            </Card>
        </Stack>
    );
}

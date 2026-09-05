import { Stack, Title } from "@mantine/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import type {
    LibraryHealthCounts,
    LibrarySummaryOut,
    PartUsageOut
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
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
import { getLibraryName } from "../../../../features/library/library-path";
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

    return (
        <Stack gap="xl">
            <Title order={2}>{getLibraryName(libraryId)}</Title>
            {summary.data ? (
                <LibraryBody
                    libraryId={libraryId}
                    summary={summary.data}
                    parts={parts}
                    health={health}
                />
            ) : (
                <DashboardState query={summary} />
            )}
        </Stack>
    );
}

function LibraryBody({
    libraryId,
    summary,
    parts,
    health
}: {
    libraryId: LibraryId;
    summary: LibrarySummaryOut;
    parts: UseQueryResult<PartUsageOut[]>;
    health: UseQueryResult<LibraryHealthCounts>;
}): ReactNode {
    const { totals, metricSeries, growth } = summary;

    return (
        <>
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
        </>
    );
}

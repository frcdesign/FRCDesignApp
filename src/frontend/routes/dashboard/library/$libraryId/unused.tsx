import { Card, Stack, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { DEFAULT_THRESHOLD } from "../../../../features/dashboard/dashboard-nav";
import {
    getUnusedOptionsQuery,
    getUnusedQuery
} from "../../../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../../../features/dashboard/dashboard-state";
import { OptionsTable } from "../../../../features/dashboard/options-table";
import { PartsTable } from "../../../../features/dashboard/parts-table";
import {
    toDayRange,
    useRangePreset
} from "../../../../features/dashboard/range";
import { m } from "../../../../paraglide/messages";

export const Route = createFileRoute("/dashboard/library/$libraryId/unused")({
    component: LowUsage
});

function LowUsage(): ReactNode {
    const { libraryId } = Route.useParams();
    // Set from the navbar, so it stays beside the library it filters.
    const search = Route.useSearch();
    const rangePreset = useRangePreset();
    const threshold = search.threshold ?? DEFAULT_THRESHOLD;
    const range = toDayRange(rangePreset);

    const parts = useQuery(getUnusedQuery(libraryId, threshold, range));
    const options = useQuery(
        getUnusedOptionsQuery(libraryId, threshold, range)
    );

    return (
        <Stack gap="xl">
            <Card>
                <Title order={4} mb="md">
                    {m.dashboardLowUsageParts()}
                </Title>
                {parts.data ? (
                    <PartsTable
                        libraryId={libraryId}
                        parts={parts.data}
                        emptyMessage={m.dashboardLowUsagePartsEmpty()}
                    />
                ) : (
                    <DashboardState
                        query={parts}
                        loading={m.dashboardLoadingLowUsageParts()}
                    />
                )}
            </Card>

            <Card>
                <Title order={4} mb="md">
                    {m.dashboardLowUsageOptions()}
                </Title>
                {options.data ? (
                    <OptionsTable
                        libraryId={libraryId}
                        options={options.data}
                        emptyMessage={m.dashboardLowUsageOptionsEmpty()}
                    />
                ) : (
                    <DashboardState
                        query={options}
                        loading={m.dashboardLoadingLowUsageOptions()}
                    />
                )}
            </Card>
        </Stack>
    );
}

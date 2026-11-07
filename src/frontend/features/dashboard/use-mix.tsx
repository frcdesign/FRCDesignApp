import { Group, Progress, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { UseSourceUsage } from "@backend/features/analytics/contract";
import { UseSource } from "@backend/features/analytics/usage";
import { formatCount, formatFraction } from "./format";
import { DashboardEmpty } from "./dashboard-state";
import { m } from "../../paraglide/messages";

function sourceLabel(source: UseSource): string {
    switch (source) {
        case UseSource.SEARCH:
            return m.dashboardSourceSearch();
        case UseSource.GROUP_SEARCH:
            return m.dashboardSourceGroupSearch();
        case UseSource.BROWSE:
            return m.dashboardSourceBrowse();
        case UseSource.FAVORITES:
            return m.dashboardSourceFavorites();
        case UseSource.RECENTS:
            return m.dashboardSourceRecents();
    }
}

interface UseSourceBreakdownProps {
    sources: UseSourceUsage[];
}

/** Where uses started from, each as a fraction of every use. */
export function UseSourceBreakdown({
    sources
}: UseSourceBreakdownProps): ReactNode {
    const total = sources.reduce((sum, source) => sum + source.count, 0);

    if (total === 0) {
        return <DashboardEmpty title={m.dashboardSourcesEmpty()} />;
    }

    return (
        <Stack gap="xs">
            {sources.map((source) => (
                <div key={source.source}>
                    <Group justify="space-between" gap="xs" mb={4}>
                        <Text>{sourceLabel(source.source)}</Text>
                        <Text c="dimmed">
                            {formatCount(source.count)} (
                            {formatFraction(source.count, total)})
                        </Text>
                    </Group>
                    <Progress value={(source.count / total) * 100} size="sm" />
                </div>
            ))}
        </Stack>
    );
}

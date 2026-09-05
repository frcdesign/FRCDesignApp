import { Group, Progress, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { InsertSourceUsage } from "@backend/features/analytics/contract";
import { InsertSource } from "@backend/features/analytics/events";
import { formatCount, formatPercent } from "./format";

const SOURCE_LABELS: Record<InsertSource, string> = {
    [InsertSource.SEARCH]: "Search results",
    [InsertSource.BROWSE]: "Browsing a group",
    [InsertSource.FAVORITES]: "Favorites list"
};

/** Headline shares of inserts: favorites, insert-and-fasten, quick insert. */
export function InsertSourceBreakdown({
    sources
}: {
    sources: InsertSourceUsage[];
}): ReactNode {
    const total = sources.reduce((sum, source) => sum + source.count, 0);

    if (total === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                No inserts recorded yet.
            </Text>
        );
    }

    return (
        <Stack gap="xs">
            {sources.map((source) => (
                <div key={source.source}>
                    <Group justify="space-between" gap="xs" mb={4}>
                        <Text size="sm">{SOURCE_LABELS[source.source]}</Text>
                        <Text size="sm" c="dimmed">
                            {formatCount(source.count)} (
                            {formatPercent(source.count, total)})
                        </Text>
                    </Group>
                    <Progress value={(source.count / total) * 100} size="sm" />
                </div>
            ))}
        </Stack>
    );
}

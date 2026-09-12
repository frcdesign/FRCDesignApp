import { Group, Progress, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { InsertSourceUsage } from "@backend/features/analytics/contract";
import { InsertSource } from "@backend/features/analytics/usage";
import { formatCount, formatFraction } from "./format";

const SOURCE_LABELS: Record<InsertSource, string> = {
    [InsertSource.SEARCH]: "Search results",
    [InsertSource.GROUP_SEARCH]: "Search within a group",
    [InsertSource.BROWSE]: "Browsing a group",
    [InsertSource.FAVORITES]: "Favorites list"
};

interface InsertSourceBreakdownProps {
    sources: InsertSourceUsage[];
}

/** Where inserts started from, each as a fraction of every insert. */
export function InsertSourceBreakdown({
    sources
}: InsertSourceBreakdownProps): ReactNode {
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
                            {formatFraction(source.count, total)})
                        </Text>
                    </Group>
                    <Progress value={(source.count / total) * 100} size="sm" />
                </div>
            ))}
        </Stack>
    );
}

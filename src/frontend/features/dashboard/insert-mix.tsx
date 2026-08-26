import {
    Card,
    Group,
    Progress,
    SimpleGrid,
    Stack,
    Table,
    Text,
    Title
} from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    InsertSourceUsage
} from "@backend/features/analytics/contract";
import { InsertSource } from "@backend/features/analytics/events";
import { formatCount, formatPercent } from "./series-utils";

const SOURCE_LABELS: Record<InsertSource, string> = {
    [InsertSource.SEARCH]: "Search results",
    [InsertSource.BROWSE]: "Browsing a group",
    [InsertSource.FAVORITES]: "Favorites list"
};

/** Headline shares of inserts: favorites, insert-and-fasten, quick insert. */
export function InsertMixTiles({
    totals
}: {
    totals: AnalyticsTotals;
}): ReactNode {
    const shares = [
        {
            label: "Favorited parts",
            part: totals.favoriteInserts,
            of: totals.inserts,
            hint: "of all inserts were a part the user had favorited"
        },
        {
            // Onshape only offers fasten on an assembly target, so measuring it
            // against every insert would just track how much assembly work
            // people happen to be doing.
            label: "Insert and fasten",
            part: totals.fastenInserts,
            of: totals.assemblyInserts,
            hint: "of assembly inserts also created a fasten mate"
        },
        {
            label: "Quick insert",
            part: totals.quickInserts,
            of: totals.inserts,
            hint: "of all inserts skipped the insert menu"
        }
    ];

    return (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {shares.map((share) => (
                <Card key={share.label} withBorder padding="lg" radius="md">
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                        {share.label}
                    </Text>
                    <Title order={2}>
                        {formatPercent(share.part, share.of)}
                    </Title>
                    <Text size="xs" c="dimmed" mt={4}>
                        {formatCount(share.part)} {share.hint}
                    </Text>
                </Card>
            ))}
        </SimpleGrid>
    );
}

/**
 * Where inserts start, and how many of each used quick insert.
 *
 * Kept as two dimensions rather than one list: quick insert is available from
 * every surface, so it is a method, not a place.
 */
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
        <Stack gap="md">
            <Stack gap="xs">
                {sources.map((source) => (
                    <div key={source.source}>
                        <Group justify="space-between" gap="xs" mb={4}>
                            <Text size="sm">
                                {SOURCE_LABELS[source.source]}
                            </Text>
                            <Text size="sm" c="dimmed">
                                {formatCount(source.count)} (
                                {formatPercent(source.count, total)})
                            </Text>
                        </Group>
                        <Progress
                            value={(source.count / total) * 100}
                            size="sm"
                        />
                    </div>
                ))}
            </Stack>

            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Started from</Table.Th>
                        <Table.Th ta="right">Insert menu</Table.Th>
                        <Table.Th ta="right">Quick insert</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {sources.map((source) => (
                        <Table.Tr key={source.source}>
                            <Table.Td>{SOURCE_LABELS[source.source]}</Table.Td>
                            <Table.Td ta="right">
                                {formatCount(
                                    source.count - source.quickInsertCount
                                )}
                            </Table.Td>
                            <Table.Td ta="right">
                                {formatCount(source.quickInsertCount)}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Stack>
    );
}

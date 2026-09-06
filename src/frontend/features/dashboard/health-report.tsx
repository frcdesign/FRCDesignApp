import { Card, Group, SimpleGrid, Table, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import type { LibraryHealthCounts } from "@backend/features/analytics/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import { IssueIcon } from "../build-status/components/issues";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { formatCount, formatPercent } from "./format";

interface HealthTilesProps {
    counts: LibraryHealthCounts;
}

/** Headline health of the library: how much of it is clean, and what isn't. */
export function HealthTiles({ counts }: HealthTilesProps): ReactNode {
    const total = counts.groupCount + counts.insertableCount;

    // Info issues are counted in the breakdown below rather than given a tile:
    // a number nobody acts on does not deserve a quarter of the row.
    const tiles = [
        {
            label: "Parts",
            value: formatCount(counts.insertableCount),
            severity: undefined
        },
        {
            label: "Healthy",
            value: formatPercent(counts.healthyItems, total),
            severity: null
        },
        {
            label: "Errors",
            value: formatCount(counts.errorCount),
            severity: BuildIssueSeverity.ERROR
        },
        {
            label: "Warnings",
            value: formatCount(counts.warningCount),
            severity: BuildIssueSeverity.WARNING
        }
    ];

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {tiles.map((tile) => (
                <Card key={tile.label} withBorder padding="lg" radius="md">
                    <Group gap="xs">
                        {tile.severity !== undefined && (
                            <IssueIcon severity={tile.severity} />
                        )}
                        <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                            {tile.label}
                        </Text>
                    </Group>
                    <Title order={2}>{tile.value}</Title>
                </Card>
            ))}
        </SimpleGrid>
    );
}

interface LibraryHealthStripProps {
    libraries: { libraryId: LibraryId; health: LibraryHealthCounts }[];
}

/**
 * Every library's health at a glance, kept apart from usage: one is current
 * state and the other a window, and one row answering both read as neither.
 */
export function LibraryHealthStrip({
    libraries
}: LibraryHealthStripProps): ReactNode {
    return (
        <Table>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Library</Table.Th>
                    <Table.Th ta="right">Parts</Table.Th>
                    <Table.Th ta="right">Healthy</Table.Th>
                    <Table.Th ta="right">Errors</Table.Th>
                    <Table.Th ta="right">Warnings</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {libraries.map(({ libraryId, health }) => (
                    <Table.Tr key={libraryId}>
                        <Table.Td>{getLibraryName(libraryId)}</Table.Td>
                        <Table.Td ta="right">
                            {formatCount(health.insertableCount)}
                        </Table.Td>
                        <Table.Td ta="right">
                            {formatPercent(
                                health.healthyItems,
                                health.groupCount + health.insertableCount
                            )}
                        </Table.Td>
                        <Table.Td ta="right">
                            {formatCount(health.errorCount)}
                        </Table.Td>
                        <Table.Td ta="right">
                            {formatCount(health.warningCount)}
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}

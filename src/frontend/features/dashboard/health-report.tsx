import { Card, Group, SimpleGrid, Table, Text, Title } from "@mantine/core";
import { WarningOctagon, Warning, Check, Info } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { LibraryHealthCounts } from "@backend/features/analytics/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { IconSize } from "../../lib/style-constants";
import { formatCount, formatPercent } from "./format";

/** Mirrors the panel's severity colors so the two views agree at a glance. */
function SeverityIcon({
    severity
}: {
    severity: BuildIssueSeverity | null;
}): ReactNode {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return (
                <WarningOctagon
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-red-6)"}
                />
            );
        case BuildIssueSeverity.WARNING:
            return (
                <Warning
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-yellow-6)"}
                />
            );
        case BuildIssueSeverity.INFO:
            return (
                <Info
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-blue-6)"}
                />
            );
        case null:
            return (
                <Check
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-green-6)"}
                />
            );
    }
}

/** Headline health of the library: how much of it is clean, and what isn't. */
export function HealthTiles({
    counts
}: {
    counts: LibraryHealthCounts;
}): ReactNode {
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
                            <SeverityIcon severity={tile.severity} />
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

/**
 * Every library's health at a glance, for the app dashboard.
 *
 * Kept apart from the usage table below it: health is current state and usage
 * is a window, and interleaving them made one row answer two questions.
 */
export function LibraryHealthStrip({
    libraries
}: {
    libraries: { libraryId: LibraryId; health: LibraryHealthCounts }[];
}): ReactNode {
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

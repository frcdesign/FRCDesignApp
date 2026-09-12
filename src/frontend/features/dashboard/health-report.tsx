import { Card, Group, SimpleGrid, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import type { LibraryHealthCounts } from "@backend/features/analytics/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import { IssueIcon } from "../build-status/components/issues";
import { formatCount, formatFraction } from "./format";

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
            value: formatFraction(counts.healthyItems, total),
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

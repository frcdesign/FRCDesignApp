import { Card, Group, SimpleGrid, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import type { LibraryHealthCounts } from "@backend/features/analytics/contract";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import { IssueIcon } from "../build-status/components/issues";
import { formatCount, formatFraction } from "./format";
import { m } from "../../paraglide/messages";

interface HealthTilesProps {
    counts: LibraryHealthCounts;
}

/** What the library holds, how much of it is clean, and what isn't. */
export function HealthTiles({ counts }: HealthTilesProps): ReactNode {
    const total = counts.groupCount + counts.insertableCount;

    // Info issues get no tile: nobody acts on them.
    const tiles = [
        {
            label: m.dashboardHealthParts(),
            value: formatCount(counts.insertableCount),
            icon: undefined
        },
        {
            label: m.dashboardHealthPartStudios(),
            value: formatCount(counts.partStudioCount),
            icon: undefined
        },
        {
            label: m.dashboardHealthAssemblies(),
            value: formatCount(counts.assemblyCount),
            icon: undefined
        },
        {
            label: m.dashboardHealthHealthy(),
            value: formatFraction(counts.healthyItems, total),
            // Every check passing is drawn as the absence of a severity.
            icon: <IssueIcon />
        },
        {
            label: m.dashboardHealthErrors(),
            value: formatCount(counts.errorCount),
            icon: <IssueIcon severity={BuildIssueSeverity.ERROR} />
        },
        {
            label: m.dashboardHealthWarnings(),
            value: formatCount(counts.warningCount),
            icon: <IssueIcon severity={BuildIssueSeverity.WARNING} />
        }
    ];

    return (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {tiles.map((tile) => (
                <Card key={tile.label}>
                    <Group gap="xs">
                        {tile.icon}
                        <Text c="dimmed" tt="uppercase" fw={700}>
                            {tile.label}
                        </Text>
                    </Group>
                    <Title order={2}>{tile.value}</Title>
                </Card>
            ))}
        </SimpleGrid>
    );
}

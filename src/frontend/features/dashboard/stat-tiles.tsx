import { Card, Group, SimpleGrid, Text, Title } from "@mantine/core";
import {
    AppWindow,
    PuzzlePiece,
    Users,
    type Icon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { AnalyticsTotals } from "@backend/features/analytics/contract";
import { IconSize } from "../../lib/style-constants";
import { formatCount } from "./series-utils";

interface StatTileProps {
    label: string;
    value: number;
    icon: Icon;
}

function StatTile({ label, value, icon: TileIcon }: StatTileProps): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" wrap="nowrap">
                <div>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Title order={2}>{formatCount(value)}</Title>
                </div>
                <TileIcon size={IconSize.CONTROL} opacity={0.25} />
            </Group>
        </Card>
    );
}

/** The three lifetime counts, shown at the top of every dashboard view. */
export function StatTiles({ totals }: { totals: AnalyticsTotals }): ReactNode {
    return (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatTile
                label="Total uses"
                value={totals.inserts}
                icon={PuzzlePiece}
            />
            <StatTile
                label="App opens"
                value={totals.appOpens}
                icon={AppWindow}
            />
            <StatTile
                label="Unique users"
                value={totals.uniqueUsers}
                icon={Users}
            />
        </SimpleGrid>
    );
}

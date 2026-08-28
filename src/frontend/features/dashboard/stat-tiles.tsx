import { Card, Group, Text, Title } from "@mantine/core";
import { type Icon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { IconSize } from "../../lib/style-constants";
import { ChangeIndicator } from "./change-indicator";
import { formatCount } from "./series-utils";

interface StatTileProps {
    label: string;
    /** A count is formatted with separators; a string is shown as given. */
    value: number | string;
    icon?: Icon;
    /**
     * Season-over-season change, drawn where the icon would be. The value above
     * it is all-time, so the indicator always names what it is measured
     * against rather than showing a bare percentage.
     */
    change?: PeriodComparison;
    trackingSince?: string | null;
}

export function StatTile({
    label,
    value,
    icon: TileIcon,
    change,
    trackingSince = null
}: StatTileProps): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Title order={2}>
                        {typeof value === "number" ? formatCount(value) : value}
                    </Title>
                </div>
                {change ? (
                    <ChangeIndicator
                        comparison={change}
                        trackingSince={trackingSince}
                        stacked
                    />
                ) : (
                    TileIcon && (
                        <TileIcon size={IconSize.CONTROL} opacity={0.25} />
                    )
                )}
            </Group>
        </Card>
    );
}

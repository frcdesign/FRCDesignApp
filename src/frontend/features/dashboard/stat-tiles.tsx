import { Card, Group, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { ChangeIndicator } from "./change-indicator";
import { AppSparkline } from "./sparkline";
import { formatCount } from "./format";

const SPARKLINE_HEIGHT = 40;

interface StatTileProps {
    label: string;
    value: number;
    /** Rates need a decimal; counts do not. Also formats the change tooltip. */
    format?: (value: number) => string;
    /** Beside the number, so a row of tiles scans as one line. */
    change?: PeriodComparison;
    /** Follows the picker even when the value is all time. */
    spark?: number[];
}

export function StatTile({
    label,
    value,
    format = formatCount,
    change,
    spark
}: StatTileProps): ReactNode {
    return (
        <Card>
            <Group justify="space-between" align="flex-start">
                <div>
                    <Text c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Title order={2}>{format(value)}</Title>
                </div>
                {change && (
                    <ChangeIndicator comparison={change} format={format} />
                )}
            </Group>
            {spark && <AppSparkline data={spark} h={SPARKLINE_HEIGHT} />}
        </Card>
    );
}

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
    /** How the measure changed, drawn to the right of the number — never below
     * it, so a row of tiles scans as one line of numbers. */
    change?: PeriodComparison;
    /** The shape over the selected window, which follows the picker even when
     * the value above is all time: a sparkline claims no total. */
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
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div>
                    <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
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

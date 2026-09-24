import { Card, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import {
    isPercentage,
    rangeValue,
    toTrend,
    type MetricDefinition
} from "./metrics";
import { formatCount, formatPercent, formatFraction } from "./format";
import { AppSparkline } from "./sparkline";

const SPARKLINE_HEIGHT = 40;

interface TrendTileProps {
    metric: MetricDefinition;
    /** Lifetime measures, shown as context beneath the range value. */
    totals: AnalyticsTotals;
    series: DailyMetricPoint[];
}

export function TrendTile({
    metric,
    totals,
    series
}: TrendTileProps): ReactNode {
    const trend = toTrend(series, metric);
    const percentage = isPercentage(metric);

    // From the same points the sparkline plots, so the two always agree.
    const range = rangeValue(series, metric);
    const value = percentage ? formatPercent(range) : formatCount(range);

    const lifetime = percentage
        ? formatFraction(
              metric.lifetimeValue(totals),
              metric.lifetimeDenominator?.(totals)
          )
        : formatCount(metric.lifetimeValue(totals));

    return (
        <Card>
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                {metric.label}
            </Text>
            <Title order={2}>{value}</Title>
            <AppSparkline
                data={trend.map((point) => point.value)}
                h={SPARKLINE_HEIGHT}
            />
            <Text size="xs" c="dimmed">
                {lifetime} all time
            </Text>
        </Card>
    );
}

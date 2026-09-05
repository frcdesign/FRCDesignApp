import {
    Card,
    Divider,
    Group,
    HoverCard,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { Info } from "@phosphor-icons/react";
import { lazy, Suspense, type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { FontWeight, IconSize } from "../../lib/style-constants";
import {
    isShare,
    rangeTerms,
    rangeValue,
    toTrend,
    type MetricDefinition
} from "./metrics";
import { formatCount, formatPercent } from "./format";

const MiniSparkline = lazy(() =>
    import("./sparkline").then((module) => ({
        default: module.MiniSparkline
    }))
);
const MetricDetailChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.MetricDetailChart
    }))
);

const SPARKLINE_HEIGHT = 40;
// Narrow enough that a middle-column tile can open the panel on either side.
const DETAIL_WIDTH = 400;

interface TrendTileProps {
    metric: MetricDefinition;
    /** Lifetime measures, shown as context beneath the range value. */
    totals: AnalyticsTotals;
    series: DailyMetricPoint[];
}

/**
 * One number, its trend, and the full chart on hover. Leads with the range so
 * it agrees with the sparkline beneath it.
 */
export function TrendTile({
    metric,
    totals,
    series
}: TrendTileProps): ReactNode {
    const trend = toTrend(series, metric);
    const share = isShare(metric);

    // From the same points the sparkline plots, so the two always agree.
    const value = share
        ? `${rangeValue(series, metric).toFixed(1)}%`
        : formatCount(rangeValue(series, metric));

    const lifetime = share
        ? formatPercent(
              metric.lifetimeValue(totals),
              metric.lifetimeDenominator?.(totals) ?? 0
          )
        : formatCount(metric.lifetimeValue(totals));

    return (
        <HoverCard
            withinPortal
            shadow="md"
            // Beside the tile, not below: the panel is taller than the gap
            // under a second-row tile. Mantine flips it when there is no room.
            position="right-start"
            withArrow
            openDelay={150}
        >
            <HoverCard.Target>
                <Card withBorder padding="lg" radius="md">
                    <Group gap={6} wrap="nowrap">
                        <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                            {metric.label}
                        </Text>
                        {/* Affordance for the hover; the card is the target. */}
                        <Info
                            size={IconSize.SMALL}
                            opacity={0.6}
                            aria-label={`About ${metric.label}`}
                        />
                    </Group>
                    <Title order={2}>{value}</Title>
                    <Suspense
                        fallback={<div style={{ height: SPARKLINE_HEIGHT }} />}
                    >
                        <MiniSparkline
                            data={trend.map((point) => point.value)}
                            h={SPARKLINE_HEIGHT}
                        />
                    </Suspense>
                    <Text size="xs" c="dimmed">
                        {lifetime} all time
                    </Text>
                </Card>
            </HoverCard.Target>
            <HoverCard.Dropdown w={DETAIL_WIDTH} p="md">
                <Stack gap="sm">
                    <div>
                        <Text fw={500}>{metric.label}</Text>
                        <Text size="xs" c="dimmed">
                            {metric.description}
                        </Text>
                    </div>
                    <MetricTerms metric={metric} series={series} />
                    <Suspense fallback={<div style={{ height: 160 }} />}>
                        <MetricDetailChart metric={metric} trend={trend} />
                    </Suspense>
                </Stack>
            </HoverCard.Dropdown>
        </HoverCard>
    );
}

/**
 * Names what went into the number, so a share reads as an explicit division
 * rather than a percentage the reader has to take on trust.
 */
function MetricTerms({
    metric,
    series
}: {
    metric: MetricDefinition;
    series: DailyMetricPoint[];
}): ReactNode {
    const terms = rangeTerms(series, metric);

    return (
        <>
            <Divider />
            <Stack gap={2}>
                <Row label={metric.numeratorLabel} value={terms.numerator} />
                {metric.denominatorLabel && (
                    <Row
                        label={metric.denominatorLabel}
                        value={terms.denominator}
                        dividedBy
                    />
                )}
            </Stack>
        </>
    );
}

function Row({
    label,
    value,
    dividedBy
}: {
    label: string;
    value: number;
    dividedBy?: boolean;
}): ReactNode {
    return (
        <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="sm" c="dimmed">
                {dividedBy ? `÷ ${label}` : label}
            </Text>
            <Text size="sm" fw={FontWeight.SEMI_BOLD}>
                {formatCount(value)}
            </Text>
        </Group>
    );
}

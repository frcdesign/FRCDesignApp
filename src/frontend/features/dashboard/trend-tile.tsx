import {
    Card,
    Divider,
    Group,
    HoverCard,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { type ComponentPropsWithRef, type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { FontWeight, IconSize } from "../../lib/style-constants";
import {
    isPercentage,
    rangeTerms,
    rangeValue,
    toTrend,
    type MetricDefinition,
    type TrendPoint
} from "./metrics";
import { formatCount, formatPercent, formatFraction } from "./format";
import { AppSparkline } from "./sparkline";

const SPARKLINE_HEIGHT = 40;
// Narrow enough that a middle-column tile can open the panel on either side.
const DETAIL_WIDTH = 400;

interface TrendTileProps {
    metric: MetricDefinition;
    /** Lifetime measures, shown as context beneath the range value. */
    totals: AnalyticsTotals;
    series: DailyMetricPoint[];
}

// Extends div props because HoverCard.Target clones its child with a ref and
// the mouse handlers that open the panel; dropping them leaves it inert.
interface TileFaceProps extends ComponentPropsWithRef<"div"> {
    metric: MetricDefinition;
    /** The range value and the all-time figure, already spelled. */
    value: string;
    lifetime: string;
    trend: TrendPoint[];
}

/** The tile itself, which is also the hover target. */
function TileFace(props: TileFaceProps): ReactNode {
    const { metric, value, lifetime, trend, ...cardProps } = props;
    return (
        <Card withBorder padding="lg" radius="md" {...cardProps}>
            <Group gap={6} wrap="nowrap">
                <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                    {metric.label}
                </Text>
                {/* Affordance for the hover; the card is the target. */}
                <InfoIcon
                    size={IconSize.SMALL}
                    opacity={0.6}
                    aria-label={`About ${metric.label}`}
                />
            </Group>
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

interface TileDetailProps {
    metric: MetricDefinition;
    series: DailyMetricPoint[];
}

/** What the hover adds: what the metric means, and the numbers behind it. */
function TileDetail(props: TileDetailProps): ReactNode {
    const { metric, series } = props;
    return (
        <Stack gap="sm">
            <div>
                <Text fw={500}>{metric.label}</Text>
                <Text size="xs" c="dimmed">
                    {metric.description}
                </Text>
            </div>
            <MetricTerms metric={metric} series={series} />
        </Stack>
    );
}

/**
 * One number and its trend, with what went into it on hover. Leads with the
 * range so it agrees with the sparkline beneath it.
 */
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
                <TileFace
                    metric={metric}
                    value={value}
                    lifetime={lifetime}
                    trend={trend}
                />
            </HoverCard.Target>
            <HoverCard.Dropdown w={DETAIL_WIDTH} p="md">
                <TileDetail metric={metric} series={series} />
            </HoverCard.Dropdown>
        </HoverCard>
    );
}

interface MetricTermsProps {
    metric: MetricDefinition;
    series: DailyMetricPoint[];
}

/**
 * Names what went into the number, so a percentage reads as the division it is
 * rather than one the reader has to take on trust.
 */
function MetricTerms({ metric, series }: MetricTermsProps): ReactNode {
    const terms = rangeTerms(series, metric);

    return (
        <>
            <Divider />
            <Stack gap={2}>
                <Row
                    role={metric.denominatorLabel ? "Numerator" : undefined}
                    label={metric.numeratorLabel}
                    value={terms.numerator}
                />
                {metric.denominatorLabel && (
                    <Row
                        role="Denominator"
                        label={metric.denominatorLabel}
                        value={terms.denominator}
                    />
                )}
            </Stack>
        </>
    );
}

interface RowProps {
    /** "Numerator" or "Denominator"; absent on a metric that divides by
     * nothing, where naming a numerator would be odd. */
    role?: string;
    label: string;
    value: number;
}

function Row({ role, label, value }: RowProps): ReactNode {
    return (
        <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="sm">
                {role && `${role}: `}
                <Text span size="sm" c="dimmed">
                    {label}
                </Text>
            </Text>
            <Text size="sm" fw={FontWeight.SEMI_BOLD}>
                {formatCount(value)}
            </Text>
        </Group>
    );
}

import {
    LineChart,
    type LineChartProps,
    type LineChartSeries
} from "@mantine/charts";
import { Card, Group, Paper, SimpleGrid, Text } from "@mantine/core";
import { type UseQueryResult } from "@tanstack/react-query";
import { type ReactNode } from "react";
import {
    ReachInterval,
    splitsNewUsers,
    type FeatureReachOut
} from "@backend/features/analytics/contract";
import { AppFeature } from "@backend/features/analytics/usage";
import { Section } from "../../components/section";
import { MUTED_MARK } from "../../lib/style-constants";
import { formatCount, formatPercent } from "./format";
import { DashboardEmpty, DashboardState } from "./dashboard-state";
import { ChartRangeControl } from "./range-control";
import {
    evenTicks,
    featureLabel,
    featureMarks,
    featureOrder,
    latestPoint,
    reachMeasure,
    ReachMeasure,
    toReachSeries,
    type ReachCount,
    type ReachPoint
} from "./feature-reach";
import { m } from "../../paraglide/messages";

// Imported here so the styles land in the dashboard's chunk.
import "@mantine/charts/styles.layer.css";

/** Small multiples: enough height to see a step, short enough for a grid of them. */
const PANEL_HEIGHT = 140;

const PERCENT_TICKS = [0, 50, 100];

/** A count's axis climbs to fit, in about this many steps. */
const COUNT_TICK_COUNT = 3;

/** As many labels as fit under a panel without crowding. */
const MAX_TICKS = 5;

/** A year of weeks still reads with dots; past that they crowd. */
const MAX_DOTTED_POINTS = 60;

/**
 * Checked apart in both themes and for color blindness; the dash tells them
 * apart too. Blue, as the app's dot for what's new.
 */
const EXISTING_COLOR = "frcGreen.7";
const NEW_COLOR = "blue.6";
const NEW_DASH = "5 3";
/** Neither group's color, for a feature whose users aren't split. */
const ALL_COLOR = "gray.6";

interface FeatureReachSectionProps {
    query: UseQueryResult<FeatureReachOut>;
}

/**
 * One panel per feature, existing and new users apart, each with its own
 * nudges marked, over the section's own range. Its controls stay while a new
 * range loads.
 */
export function FeatureReachSection({
    query
}: FeatureReachSectionProps): ReactNode {
    return (
        <Section
            title={m.dashboardFeatureReach()}
            aside={<ChartRangeControl searchKey="featureRange" />}
        >
            <SplitLegend />
            {query.data ? (
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                    {featureOrder().map((feature) => {
                        const measure = reachMeasure(query.data, feature);
                        return (
                            <FeatureReachPanel
                                key={feature}
                                feature={feature}
                                measure={measure}
                                points={toReachSeries(
                                    query.data,
                                    feature,
                                    measure
                                )}
                                interval={query.data.interval}
                            />
                        );
                    })}
                </SimpleGrid>
            ) : (
                <DashboardState
                    query={query}
                    loading={m.dashboardLoadingFeatureReach()}
                />
            )}
        </Section>
    );
}

/** One legend for the panels that split their users. */
function SplitLegend(): ReactNode {
    return (
        <Group gap="lg">
            <LegendItem
                color={EXISTING_COLOR}
                label={m.dashboardFeatureReachExisting()}
            />
            <LegendItem
                color={NEW_COLOR}
                dash={NEW_DASH}
                label={m.dashboardFeatureReachNew()}
            />
        </Group>
    );
}

interface LegendItemProps {
    color: string;
    dash?: string;
    label: string;
}

function LegendItem({ color, dash, label }: LegendItemProps): ReactNode {
    return (
        <Group gap={6} wrap="nowrap">
            <svg width={20} height={4}>
                <line
                    x1={0}
                    y1={2}
                    x2={20}
                    y2={2}
                    stroke={`var(--mantine-color-${color.replace(".", "-")})`}
                    strokeWidth={2}
                    strokeDasharray={dash}
                />
            </svg>
            <Text size="sm">{label}</Text>
        </Group>
    );
}

const SERIES: LineChartSeries[] = [
    {
        name: "existingValue",
        label: m.dashboardFeatureReachExisting(),
        color: EXISTING_COLOR
    },
    {
        name: "newValue",
        label: m.dashboardFeatureReachNew(),
        color: NEW_COLOR,
        strokeDasharray: NEW_DASH
    }
];

function seriesOf(feature: AppFeature): LineChartSeries[] {
    if (splitsNewUsers(feature)) return SERIES;
    return [{ name: "value", label: featureLabel(feature), color: ALL_COLOR }];
}

interface FeatureReachPanelProps {
    feature: AppFeature;
    measure: ReachMeasure;
    points: ReachPoint[];
    interval: ReachInterval;
}

function FeatureReachPanel({
    feature,
    measure,
    points,
    interval
}: FeatureReachPanelProps): ReactNode {
    const latest = latestPoint(points);
    const middle = points[Math.floor(points.length / 2)]?.bucket ?? "";
    return (
        <Card>
            <Group justify="space-between" align="flex-start" mb="xs">
                <Text fw={700}>{featureLabel(feature)}</Text>
                {latest?.value != null && (
                    <Text c="dimmed">
                        {latestLabel(
                            interval,
                            formatHeadline(latest.value, measure, feature)
                        )}
                    </Text>
                )}
            </Group>
            {latest ? (
                <LineChart
                    h={PANEL_HEIGHT}
                    data={points}
                    dataKey="bucket"
                    xAxisProps={{
                        ticks: evenTicks(
                            points.map((point) => point.bucket),
                            MAX_TICKS
                        ),
                        interval: 0,
                        tickFormatter: toLabel(points)
                    }}
                    yAxisProps={axisFor(measure)}
                    valueFormatter={(value) => formatValue(value, measure)}
                    curveType="monotone"
                    withDots={points.length <= MAX_DOTTED_POINTS}
                    tooltipProps={{
                        content: ({ payload }) => (
                            <ReachTooltip
                                point={
                                    payload?.[0]?.payload as
                                        | ReachPoint
                                        | undefined
                                }
                                interval={interval}
                                measure={measure}
                                feature={feature}
                            />
                        )
                    }}
                    referenceLines={featureMarks(feature, points, interval).map(
                        (mark) => ({
                            x: mark.bucket,
                            color: MUTED_MARK,
                            strokeDasharray: "4 4",
                            label: mark.label,
                            // Toward the middle, so a label at either end stays on the card.
                            labelPosition:
                                mark.bucket > middle
                                    ? "insideTopRight"
                                    : "insideTopLeft"
                        })
                    )}
                    series={seriesOf(feature)}
                />
            ) : (
                <DashboardEmpty title={m.dashboardFeatureReachNoData()} />
            )}
        </Card>
    );
}

interface ReachTooltipProps {
    point: ReachPoint | undefined;
    interval: ReachInterval;
    measure: ReachMeasure;
    feature: AppFeature;
}

/** The value with what it's a share of, since a small day or week swings it. */
function ReachTooltip({
    point,
    interval,
    measure,
    feature
}: ReachTooltipProps): ReactNode {
    if (point?.value == null) return null;
    const newCount = point.newCount;
    return (
        <Paper px="md" py="sm" withBorder shadow="md">
            <Text fw={700}>
                {interval === ReachInterval.WEEK
                    ? m.dashboardFeatureReachWeekOf({ week: point.label })
                    : point.label}
            </Text>
            {newCount ? (
                <>
                    <TooltipLine
                        value={m.dashboardFeatureReachExistingLine({
                            value: formatOptional(point.existingValue, measure)
                        })}
                        count={point.existingCount}
                        measure={measure}
                    />
                    <TooltipLine
                        value={m.dashboardFeatureReachNewLine({
                            value: formatOptional(point.newValue, measure)
                        })}
                        count={newCount}
                        measure={measure}
                    />
                </>
            ) : (
                <TooltipLine
                    value={formatHeadline(point.value, measure, feature)}
                    count={point}
                    measure={measure}
                />
            )}
        </Paper>
    );
}

interface TooltipLineProps {
    value: string;
    count: ReachCount | undefined;
    measure: ReachMeasure;
}

/** A share says what it's of. */
function TooltipLine({ value, count, measure }: TooltipLineProps): ReactNode {
    return (
        <>
            <Text>{value}</Text>
            {count && measure === ReachMeasure.SHARE && (
                <Text c="dimmed">
                    {m.dashboardFeatureReachUsers({
                        users: count.users,
                        activeUsers: count.activeUsers
                    })}
                </Text>
            )}
        </>
    );
}

/** Every share on one fixed axis, so their heights compare; a count's fits it. */
function axisFor(measure: ReachMeasure): LineChartProps["yAxisProps"] {
    switch (measure) {
        case ReachMeasure.SHARE:
            return {
                domain: [0, 100],
                ticks: PERCENT_TICKS,
                tickFormatter: (value: number) => `${value}%`
            };
        case ReachMeasure.TIMES:
            return {
                domain: [0, "auto"],
                allowDecimals: false,
                tickCount: COUNT_TICK_COUNT,
                tickFormatter: (value: number) => formatCount(value)
            };
    }
}

function latestLabel(interval: ReachInterval, value: string): string {
    switch (interval) {
        case ReachInterval.DAY:
            return m.dashboardFeatureReachLatestDay({ value });
        case ReachInterval.WEEK:
            return m.dashboardFeatureReachLatest({ value });
    }
}

/** As an axis or a line in a list shows it: "18.0%", "37". */
function formatValue(value: number, measure: ReachMeasure): string {
    switch (measure) {
        case ReachMeasure.SHARE:
            return formatPercent(value);
        case ReachMeasure.TIMES:
            return formatCount(value);
    }
}

/** On its own: "18.0%", "37 reports". */
function formatHeadline(
    value: number,
    measure: ReachMeasure,
    feature: AppFeature
): string {
    switch (measure) {
        case ReachMeasure.SHARE:
            return formatPercent(value);
        case ReachMeasure.TIMES:
            return formatTimes(value, feature);
    }
}

/** In what one use of the feature is. */
function formatTimes(count: number, feature: AppFeature): string {
    switch (feature) {
        case AppFeature.REPORT:
            return m.dashboardFeatureReachReports({ count });
        case AppFeature.VERSION_MANAGER:
            return m.dashboardFeatureReachRuns({ count });
        case AppFeature.FEATURESCRIPTS:
            return m.dashboardFeatureReachAdds({ count });
        case AppFeature.DEFAULT_CONFIGURATION:
            return m.dashboardFeatureReachSaves({ count });
        case AppFeature.SEARCH:
        case AppFeature.FAVORITES:
        case AppFeature.RECENTS:
        case AppFeature.QUICK_INSERT:
        case AppFeature.FASTEN:
        case AppFeature.PRESELECTION:
        case AppFeature.AUTO_ASSEMBLY:
        case AppFeature.INSERT_LOCATION:
        case AppFeature.DOWNLOAD:
            return m.dashboardFeatureReachUses({ count });
    }
}

/** A group with nothing to state, such as a share of nobody. */
function formatOptional(value: number | null, measure: ReachMeasure): string {
    return value === null ? "—" : formatValue(value, measure);
}

function toLabel(points: ReachPoint[]): (bucket: string) => string {
    const labels = new Map(points.map((point) => [point.bucket, point.label]));
    return (bucket) => labels.get(bucket) ?? bucket;
}

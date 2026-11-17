import {
    LineChart,
    type LineChartProps,
    type LineChartSeries
} from "@mantine/charts";
import {
    Card,
    Group,
    Paper,
    SegmentedControl,
    SimpleGrid,
    Stack,
    Text
} from "@mantine/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode } from "react";
import type { FeatureReachOut } from "@backend/features/analytics/contract";
import { type AppFeature } from "@backend/features/analytics/usage";
import { Section } from "../../components/section";
import { MUTED_MARK, PrimaryColor } from "../../lib/style-constants";
import { formatCount, formatPercent } from "./format";
import { DashboardEmpty } from "./dashboard-state";
import {
    featureLabel,
    featureMeasure,
    featureOrder,
    latestPoint,
    nudgeMarks,
    ReachMeasure,
    ReachView,
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

/** A year of weeks still reads with dots; past that they crowd. */
const MAX_DOTTED_WEEKS = 60;

/**
 * Checked apart in both themes and for color blindness; the dash tells them
 * apart too. Blue, as the app's dot for what's new.
 */
const EXISTING_COLOR = "frcGreen.7";
const NEW_COLOR = "blue.6";
const NEW_DASH = "5 3";

function useReachView(): ReachView {
    const search = useSearch({ from: "/dashboard" });
    return search.reach ?? ReachView.ALL;
}

interface FeatureReachSectionProps {
    reach: FeatureReachOut;
}

/** One panel per feature, each with its own nudges marked. */
export function FeatureReachSection({
    reach
}: FeatureReachSectionProps): ReactNode {
    const view = useReachView();
    return (
        <Section title={m.dashboardFeatureReach()}>
            <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                    <Text c="dimmed">
                        {m.dashboardFeatureReachDescription()}
                    </Text>
                    {view === ReachView.NEW_VS_EXISTING && <SplitLegend />}
                </Stack>
                <ReachViewControl view={view} />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {featureOrder().map((feature) => (
                    <FeatureReachPanel
                        key={feature}
                        feature={feature}
                        points={toReachSeries(reach, feature)}
                        view={view}
                    />
                ))}
            </SimpleGrid>
        </Section>
    );
}

interface ReachViewControlProps {
    view: ReachView;
}

function ReachViewControl({ view }: ReachViewControlProps): ReactNode {
    const navigate = useNavigate();
    return (
        <SegmentedControl
            size="xs"
            value={view}
            onChange={(value) =>
                void navigate({
                    to: ".",
                    search: (search) => ({ ...search, reach: value })
                })
            }
            data={[
                {
                    value: ReachView.ALL,
                    label: m.dashboardFeatureReachViewAll()
                },
                {
                    value: ReachView.NEW_VS_EXISTING,
                    label: m.dashboardFeatureReachViewSplit()
                }
            ]}
        />
    );
}

/** One legend for every panel, since they all draw the same two lines. */
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

function seriesFor(view: ReachView, feature: AppFeature): LineChartSeries[] {
    switch (view) {
        case ReachView.ALL:
            return [
                {
                    name: "value",
                    label: featureLabel(feature),
                    color: PrimaryColor.FILLED
                }
            ];
        case ReachView.NEW_VS_EXISTING:
            return [
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
    }
}

interface FeatureReachPanelProps {
    feature: AppFeature;
    points: ReachPoint[];
    view: ReachView;
}

function FeatureReachPanel({
    feature,
    points,
    view
}: FeatureReachPanelProps): ReactNode {
    const latest = latestPoint(points);
    const measure = featureMeasure(feature);
    const middle = points[Math.floor(points.length / 2)]?.bucket ?? "";
    return (
        <Card>
            <Group justify="space-between" mb="xs">
                <Text fw={700}>{featureLabel(feature)}</Text>
                {latest?.value != null && (
                    <Text c="dimmed">
                        {m.dashboardFeatureReachLatest({
                            value: formatHeadline(latest.value, measure)
                        })}
                    </Text>
                )}
            </Group>
            {latest ? (
                <LineChart
                    h={PANEL_HEIGHT}
                    data={points}
                    dataKey="bucket"
                    xAxisProps={{ tickFormatter: toLabel(points) }}
                    yAxisProps={axisFor(measure)}
                    valueFormatter={(value) => formatValue(value, measure)}
                    curveType="monotone"
                    withDots={points.length <= MAX_DOTTED_WEEKS}
                    tooltipProps={{
                        content: ({ payload }) => (
                            <ReachTooltip
                                point={
                                    payload?.[0]?.payload as
                                        | ReachPoint
                                        | undefined
                                }
                                view={view}
                                measure={measure}
                            />
                        )
                    }}
                    referenceLines={nudgeMarks(feature, points).map((mark) => ({
                        x: mark.bucket,
                        color: MUTED_MARK,
                        strokeDasharray: "4 4",
                        label: mark.label,
                        // Toward the middle, so a label at either end stays on the card.
                        labelPosition:
                            mark.bucket > middle
                                ? "insideTopRight"
                                : "insideTopLeft"
                    }))}
                    series={seriesFor(view, feature)}
                />
            ) : (
                <DashboardEmpty title={m.dashboardFeatureReachNoData()} />
            )}
        </Card>
    );
}

interface ReachTooltipProps {
    point: ReachPoint | undefined;
    view: ReachView;
    measure: ReachMeasure;
}

/** The value with what it's a share of, since a small week swings it. */
function ReachTooltip({ point, view, measure }: ReachTooltipProps): ReactNode {
    if (point?.value == null) return null;
    const newCount =
        view === ReachView.NEW_VS_EXISTING ? point.newCount : undefined;
    return (
        <Paper px="md" py="sm" withBorder shadow="md">
            <Text fw={700}>
                {m.dashboardFeatureReachWeekOf({ week: point.label })}
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
                    value={formatHeadline(point.value, measure)}
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

/** A share says what it's of; a count already is the number of people. */
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
        case ReachMeasure.USERS:
            return {
                domain: [0, "auto"],
                allowDecimals: false,
                tickCount: COUNT_TICK_COUNT,
                tickFormatter: (value: number) => formatCount(value)
            };
    }
}

/** As an axis or a line in a list shows it: "18.0%", "37". */
function formatValue(value: number, measure: ReachMeasure): string {
    switch (measure) {
        case ReachMeasure.SHARE:
            return formatPercent(value);
        case ReachMeasure.USERS:
            return formatCount(value);
    }
}

/** On its own: "18.0%", "37 users". */
function formatHeadline(value: number, measure: ReachMeasure): string {
    switch (measure) {
        case ReachMeasure.SHARE:
            return formatPercent(value);
        case ReachMeasure.USERS:
            return m.dashboardFeatureReachUserCount({ count: value });
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

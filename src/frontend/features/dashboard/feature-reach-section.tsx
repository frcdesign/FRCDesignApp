import { LineChart, type LineChartSeries } from "@mantine/charts";
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
import {
    NEW_USER_WEEKS,
    type FeatureReachOut
} from "@backend/features/analytics/contract";
import { type AppFeature } from "@backend/features/analytics/usage";
import { Section } from "../../components/section";
import { MUTED_MARK, PrimaryColor } from "../../lib/style-constants";
import { formatPercent } from "./format";
import { DashboardEmpty } from "./dashboard-state";
import {
    featureLabel,
    featureOrder,
    latestReach,
    nudgeMarks,
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

/** A year of weeks still reads with dots; past that they crowd. */
const MAX_DOTTED_WEEKS = 60;

/** Checked apart in both themes and for color blindness; the dash tells them apart too. */
const EXISTING_COLOR = "frcGreen.7";
const NEW_COLOR = "grape.6";
const NEW_DASH = "5 3";

function useReachView(): ReachView {
    const search = useSearch({ from: "/dashboard" });
    return search.reach ?? ReachView.ALL;
}

interface FeatureReachSectionProps {
    reach: FeatureReachOut;
}

/** One panel per feature, each with its own nudges marked, on a shared 0–100% axis. */
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
                    search: (search) => ({
                        ...search,
                        reach: value
                    })
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
                label={m.dashboardFeatureReachNew({ weeks: NEW_USER_WEEKS })}
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
                    name: "reach",
                    label: featureLabel(feature),
                    color: PrimaryColor.FILLED
                }
            ];
        case ReachView.NEW_VS_EXISTING:
            return [
                {
                    name: "existingReach",
                    label: m.dashboardFeatureReachExisting(),
                    color: EXISTING_COLOR
                },
                {
                    name: "newReach",
                    label: m.dashboardFeatureReachNew({
                        weeks: NEW_USER_WEEKS
                    }),
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
    const latest = latestReach(points);
    const middle = points[Math.floor(points.length / 2)]?.bucket ?? "";
    return (
        <Card>
            <Group justify="space-between" mb="xs">
                <Text fw={700}>{featureLabel(feature)}</Text>
                {latest?.reach != null && (
                    <Text c="dimmed">
                        {m.dashboardFeatureReachLatest({
                            share: formatPercent(latest.reach)
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
                    // Every panel on one axis, so their heights compare.
                    yAxisProps={{
                        domain: [0, 100],
                        ticks: PERCENT_TICKS,
                        tickFormatter: (value: number) => `${value}%`
                    }}
                    valueFormatter={formatPercent}
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
}

/** The share with what it's a share of, since a small week swings it. */
function ReachTooltip({ point, view }: ReachTooltipProps): ReactNode {
    if (point?.reach == null) return null;
    return (
        <Paper px="md" py="sm" withBorder shadow="md">
            <Text fw={700}>
                {m.dashboardFeatureReachWeekOf({ week: point.label })}
            </Text>
            {view === ReachView.ALL || !point.newCount ? (
                <TooltipShare
                    share={formatPercent(point.reach)}
                    count={point}
                />
            ) : (
                <>
                    {point.existingCount && (
                        <TooltipShare
                            share={m.dashboardFeatureReachExistingShare({
                                share: formatShare(point.existingReach)
                            })}
                            count={point.existingCount}
                        />
                    )}
                    <TooltipShare
                        share={m.dashboardFeatureReachNewShare({
                            share: formatShare(point.newReach)
                        })}
                        count={point.newCount}
                    />
                </>
            )}
        </Paper>
    );
}

interface TooltipShareProps {
    share: string;
    count: ReachCount;
}

function TooltipShare({ share, count }: TooltipShareProps): ReactNode {
    return (
        <>
            <Text>{share}</Text>
            <Text c="dimmed">
                {m.dashboardFeatureReachUsers({
                    users: count.users,
                    activeUsers: count.activeUsers
                })}
            </Text>
        </>
    );
}

/** A group nobody in was about that week has no share. */
function formatShare(reach: number | null): string {
    return reach === null ? "—" : formatPercent(reach);
}

function toLabel(points: ReachPoint[]): (bucket: string) => string {
    const labels = new Map(points.map((point) => [point.bucket, point.label]));
    return (bucket) => labels.get(bucket) ?? bucket;
}

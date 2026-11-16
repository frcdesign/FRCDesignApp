import { LineChart } from "@mantine/charts";
import { Card, Group, Paper, SimpleGrid, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { FeatureReachOut } from "@backend/features/analytics/contract";
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
    toReachSeries,
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

interface FeatureReachSectionProps {
    reach: FeatureReachOut;
}

/** One panel per feature, each with its own nudges marked, on a shared 0–100% axis. */
export function FeatureReachSection({
    reach
}: FeatureReachSectionProps): ReactNode {
    return (
        <Section title={m.dashboardFeatureReach()}>
            <Text c="dimmed">{m.dashboardFeatureReachDescription()}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {featureOrder().map((feature) => (
                    <FeatureReachPanel
                        key={feature}
                        feature={feature}
                        points={toReachSeries(reach, feature)}
                    />
                ))}
            </SimpleGrid>
        </Section>
    );
}

interface FeatureReachPanelProps {
    feature: AppFeature;
    points: ReachPoint[];
}

function FeatureReachPanel({
    feature,
    points
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
                    series={[
                        {
                            name: "reach",
                            label: featureLabel(feature),
                            color: PrimaryColor.FILLED
                        }
                    ]}
                />
            ) : (
                <DashboardEmpty title={m.dashboardFeatureReachNoData()} />
            )}
        </Card>
    );
}

interface ReachTooltipProps {
    point: ReachPoint | undefined;
}

/** The share with what it's a share of, since a small week swings it. */
function ReachTooltip({ point }: ReachTooltipProps): ReactNode {
    if (point?.reach == null) return null;
    return (
        <Paper px="md" py="sm" withBorder shadow="md">
            <Text fw={700}>
                {m.dashboardFeatureReachWeekOf({ week: point.label })}
            </Text>
            <Text>{formatPercent(point.reach)}</Text>
            <Text c="dimmed">
                {m.dashboardFeatureReachUsers({
                    users: point.users,
                    activeUsers: point.activeUsers
                })}
            </Text>
        </Paper>
    );
}

function toLabel(points: ReachPoint[]): (bucket: string) => string {
    const labels = new Map(points.map((point) => [point.bucket, point.label]));
    return (bucket) => labels.get(bucket) ?? bucket;
}

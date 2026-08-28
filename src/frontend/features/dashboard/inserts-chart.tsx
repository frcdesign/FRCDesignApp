import { Card, Group, SegmentedControl, Title } from "@mantine/core";
import { lazy, Suspense, useState, type ReactNode } from "react";
import type {
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { LIBRARY_PROGRAM, Program } from "@backend/features/analytics/seasons";
import { type Granularity } from "./buckets";
import { METRICS, toTrend } from "./metrics";

const LibraryInsertsChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.LibraryInsertsChart
    }))
);

const MetricDetailChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.MetricDetailChart
    }))
);

/** Tall enough to read a year of daily points without squinting. */
const PAGE_CHART_HEIGHT = 280;

/**
 * Weekly or monthly, never a shorter window.
 *
 * The honest version of the knob people reach for on a chart: the window is
 * always everything recorded, and only how finely it is cut changes — so a
 * quiet month can never be hidden by narrowing the range.
 */
const GRANULARITIES = [
    { value: "week", label: "Weekly" },
    { value: "month", label: "Monthly" }
];

function ChartCard({
    title,
    granularity,
    onGranularityChange,
    children
}: {
    title: string;
    granularity?: Granularity;
    onGranularityChange?: (value: Granularity) => void;
    children: ReactNode;
}): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" align="flex-start" mb="md">
                <Title order={4}>{title}</Title>
                {granularity && onGranularityChange && (
                    <SegmentedControl
                        size="xs"
                        value={granularity}
                        onChange={(value) =>
                            onGranularityChange(value as Granularity)
                        }
                        data={GRANULARITIES}
                    />
                )}
            </Group>
            <Suspense fallback={<div style={{ height: PAGE_CHART_HEIGHT }} />}>
                {children}
            </Suspense>
        </Card>
    );
}

/** Every library on one axis, for the app dashboard. */
export function InsertsByLibraryCard({
    series
}: {
    series: DailyInsertPoint[];
}): ReactNode {
    const [granularity, setGranularity] = useState<Granularity>("month");

    return (
        <ChartCard
            title="Uses over time"
            granularity={granularity}
            onGranularityChange={setGranularity}
        >
            {/* The app spans both competitions, so both are marked. */}
            <LibraryInsertsChart
                series={series}
                h={PAGE_CHART_HEIGHT}
                programs={[Program.FTC, Program.FRC]}
                granularity={granularity}
            />
        </ChartCard>
    );
}

/** The one library's own line, for the library dashboard. */
export function InsertsOverTimeCard({
    series,
    libraryId
}: {
    series: DailyMetricPoint[];
    libraryId: LibraryId;
}): ReactNode {
    return (
        <ChartCard title="Uses over time">
            <MetricDetailChart
                metric={METRICS.inserts}
                trend={toTrend(series, METRICS.inserts)}
                h={PAGE_CHART_HEIGHT}
                programs={[LIBRARY_PROGRAM[libraryId]]}
            />
        </ChartCard>
    );
}

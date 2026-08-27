import { Card, Title } from "@mantine/core";
import { lazy, Suspense, type ReactNode } from "react";
import type {
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { METRICS } from "./metrics";
import { toTrend } from "./metrics";

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

function ChartCard({
    title,
    children
}: {
    title: string;
    children: ReactNode;
}): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Title order={4} mb="md">
                {title}
            </Title>
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
    return (
        <ChartCard title="Uses over time">
            <LibraryInsertsChart series={series} h={PAGE_CHART_HEIGHT} />
        </ChartCard>
    );
}

/** The one library's own line, for the library dashboard. */
export function InsertsOverTimeCard({
    series
}: {
    series: DailyMetricPoint[];
}): ReactNode {
    return (
        <ChartCard title="Uses over time">
            <MetricDetailChart
                metric={METRICS.inserts}
                trend={toTrend(series, METRICS.inserts)}
                h={PAGE_CHART_HEIGHT}
            />
        </ChartCard>
    );
}

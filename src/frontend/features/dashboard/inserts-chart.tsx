import { lazy, Suspense, type ReactNode } from "react";
import type {
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { LIBRARY_PROGRAM, Program } from "@backend/features/analytics/seasons";
import { METRICS, toTrend } from "./metrics";
import { SectionCard } from "./section";

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
        <SectionCard title={title}>
            <Suspense fallback={<div style={{ height: PAGE_CHART_HEIGHT }} />}>
                {children}
            </Suspense>
        </SectionCard>
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
            {/* Always monthly: this one plots everything recorded, and a finer
                cut of two years is noise rather than detail. The app spans
                both competitions, so both are marked. */}
            <LibraryInsertsChart
                series={series}
                h={PAGE_CHART_HEIGHT}
                programs={[Program.FTC, Program.FRC]}
                granularity="month"
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

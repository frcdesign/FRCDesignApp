import { type ReactNode } from "react";
import { LibraryInsertsChart, MetricDetailChart } from "./trend-chart";
import { Granularity } from "./series";
import type {
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { LIBRARY_PROGRAM, Program } from "@backend/features/analytics/seasons";
import { METRICS, toTrend } from "./metrics";
import { SectionCard } from "../../components/section";

interface InsertsByLibraryCardProps {
    series: DailyInsertPoint[];
}

/** Tall enough to read a year of daily points without squinting. */
const PAGE_CHART_HEIGHT = 280;

function ChartCard({
    title,
    children
}: {
    title: string;
    children: ReactNode;
}): ReactNode {
    return <SectionCard title={title}>{children}</SectionCard>;
}

/** Every library on one axis, for the app dashboard. */
export function InsertsByLibraryCard({
    series
}: InsertsByLibraryCardProps): ReactNode {
    return (
        <ChartCard title="Uses over time">
            {/* Always monthly: this one plots everything recorded, and a finer
                cut of two years is noise rather than detail. The app spans
                both competitions, so both are marked. */}
            <LibraryInsertsChart
                series={series}
                h={PAGE_CHART_HEIGHT}
                programs={[Program.FTC, Program.FRC]}
                granularity={Granularity.MONTH}
            />
        </ChartCard>
    );
}

interface InsertsOverTimeCardProps {
    series: DailyMetricPoint[];
    libraryId: LibraryId;
}

/** The one library's own line, for the library dashboard. */
export function InsertsOverTimeCard({
    series,
    libraryId
}: InsertsOverTimeCardProps): ReactNode {
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

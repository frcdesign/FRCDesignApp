import { type ReactNode } from "react";
import { LibraryUsesChart, MetricDetailChart } from "./trend-chart";
import { Granularity } from "./series";
import type {
    DailyUsePoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { LIBRARY_PROGRAM, Program } from "@backend/features/analytics/seasons";
import { METRICS, toTrend } from "./metrics";
import { SectionCard } from "../../components/section";
import { m } from "../../paraglide/messages";

interface UsesByLibraryCardProps {
    series: DailyUsePoint[];
}

/** Tall enough to read a year of daily points without squinting. */
const PAGE_CHART_HEIGHT = 280;

/** Every library on one axis, for the app dashboard. */
export function UsesByLibraryCard({
    series
}: UsesByLibraryCardProps): ReactNode {
    return (
        <SectionCard title={m.dashboardUsesOverTime()}>
            {/* Always monthly: this one plots everything recorded, and a finer
                cut of two years is noise rather than detail. The app spans
                both competitions, so both are marked. */}
            <LibraryUsesChart
                series={series}
                h={PAGE_CHART_HEIGHT}
                programs={[Program.FTC, Program.FRC]}
                granularity={Granularity.MONTH}
            />
        </SectionCard>
    );
}

interface UsesOverTimeCardProps {
    series: DailyMetricPoint[];
    libraryId: LibraryId;
}

/** The one library's own line, for the library dashboard. */
export function UsesOverTimeCard({
    series,
    libraryId
}: UsesOverTimeCardProps): ReactNode {
    return (
        <SectionCard title={m.dashboardUsesOverTime()}>
            <MetricDetailChart
                metric={METRICS.uses}
                trend={toTrend(series, METRICS.uses)}
                h={PAGE_CHART_HEIGHT}
                programs={[LIBRARY_PROGRAM[libraryId]]}
            />
        </SectionCard>
    );
}

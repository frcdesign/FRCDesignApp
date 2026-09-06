import { LineChart } from "@mantine/charts";
import { type ReactNode } from "react";
import type { DailyInsertPoint } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { getLibraryColor } from "../../theme";
import { toChartData } from "./series";
import { type BucketPoint, type Granularity } from "./series";
import type { ChartReferenceLineProps } from "@mantine/charts";
import { Program, seasonsBetween } from "@backend/features/analytics/seasons";
import { isShare, type MetricDefinition, type TrendPoint } from "./metrics";

// Kept in this lazily-loaded module so recharts and its styles stay out of the
// Onshape panel bundle entirely.
import "@mantine/charts/styles.layer.css";

// Keeps the hover panel short enough to fit beside a tile on a laptop.
const DETAIL_HEIGHT = 160;

export interface MetricDetailChartProps {
    metric: MetricDefinition;
    trend: TrendPoint[];
    /** Taller when the chart is the page's own, not a hover panel's. */
    h?: number;
    /** Marks kickoffs and championships; omitted in the tile hover panels. */
    programs?: Program[];
}

/** The same numbers as the sparkline, with axes and a tooltip. */
export function MetricDetailChart({
    metric,
    trend,
    h = DETAIL_HEIGHT,
    programs
}: MetricDetailChartProps): ReactNode {
    const share = isShare(metric);
    return (
        <LineChart
            h={h}
            data={trend}
            dataKey="bucket"
            xAxisProps={{ tickFormatter: toLabel(trend) }}
            curveType="monotone"
            withDots={trend.length <= 45}
            yAxisLabel={metric.detailLabel}
            // A share is only comparable against a fixed axis.
            yAxisProps={share ? { domain: [0, 100] } : undefined}
            valueFormatter={(value) => (share ? `${value}%` : String(value))}
            referenceLines={seasonLines(programs, trend)}
            series={[
                {
                    name: "value",
                    label: metric.detailLabel,
                    color: "var(--mantine-primary-color-filled)"
                }
            ]}
        />
    );
}

export interface LibraryInsertsChartProps {
    series: DailyInsertPoint[];
    /** Taller when the chart is the page's own, not a hover panel's. */
    h?: number;
    /** Marks kickoffs and championships; omitted in the tile hover panels. */
    programs?: Program[];
    /** Overrides the granularity picked from the span. */
    granularity?: Granularity;
}

/** Inserts split by library — the one trend that is genuinely multi-series. */
export function LibraryInsertsChart({
    series,
    h = DETAIL_HEIGHT,
    programs,
    granularity
}: LibraryInsertsChartProps): ReactNode {
    const libraryIds = Object.values(LibraryId);
    const data = toChartData(series, libraryIds, granularity);
    return (
        <LineChart
            h={h}
            data={data}
            dataKey="bucket"
            xAxisProps={{ tickFormatter: toLabel(data) }}
            withLegend
            withDots={series.length <= 45}
            curveType="monotone"
            yAxisLabel="Total uses"
            referenceLines={seasonLines(programs, data)}
            series={libraryIds.map((libraryId) => ({
                name: getLibraryName(libraryId),
                color: `${getLibraryColor(libraryId)}.6`
            }))}
        />
    );
}

/**
 * Season markers, placed by month: a season opens and closes on month bounds,
 * and the championship closing it moves within its month every year.
 */
function seasonLines(
    programs: Program[] | undefined,
    points: BucketPoint[]
): ChartReferenceLineProps[] {
    if (!programs?.length || points.length === 0) return [];
    const buckets = points.map((point) => point.bucket);
    const first = buckets[0];
    const last = buckets[buckets.length - 1];

    const labels = new Map<string, string[]>();
    const mark = (month: string, label: string) => {
        // A monthly bucket is the month; a finer one falls inside it, and the
        // first such bucket is where the month begins on the axis.
        const bucket = buckets.find((candidate) => candidate.startsWith(month));
        if (bucket === undefined) return;
        const existing = labels.get(bucket) ?? [];
        if (!existing.includes(label)) labels.set(bucket, [...existing, label]);
    };

    for (const program of programs) {
        for (const season of seasonsBetween(program, first, last)) {
            mark(season.startMonth, `${program.toUpperCase()} kickoff`);
            // Both programs close at the same event, so this deduplicates.
            mark(season.endMonth, "Championship");
        }
    }

    return [...labels.entries()].map(([bucket, names]) => ({
        x: bucket,
        color: "gray.5",
        strokeDasharray: "4 4",
        label: names.join(" · "),
        labelPosition: "top" as const
    }));
}

/** Ticks show the label; bands match the raw key the axis is actually keyed on. */
function toLabel(points: BucketPoint[]): (bucket: string) => string {
    const labels = new Map(points.map((point) => [point.bucket, point.label]));
    return (bucket) => labels.get(bucket) ?? bucket;
}

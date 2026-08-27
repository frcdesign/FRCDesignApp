import { LineChart, Sparkline } from "@mantine/charts";
import { ReferenceArea } from "recharts";
import { type ReactNode } from "react";
import type {
    DailyInsertPoint,
    SeasonCurveOut
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { getLibraryColor } from "../../theme";
import { toChartData } from "./series-utils";
import { type BucketPoint, type Granularity } from "./buckets";
import { Program, seasonsBetween } from "@backend/features/analytics/seasons";
import { isShare, type MetricDefinition, type TrendPoint } from "./metrics";

// Kept in this lazily-loaded module so recharts and its styles stay out of the
// Onshape panel bundle entirely.
import "@mantine/charts/styles.layer.css";

const SPARKLINE_HEIGHT = 40;
// Keeps the hover panel short enough to fit beside a tile on a laptop.
const DETAIL_HEIGHT = 160;

/** The inline trend on a tile: shape only, no axes. */
export function MetricSparkline({ trend }: { trend: TrendPoint[] }): ReactNode {
    return (
        <Sparkline
            h={SPARKLINE_HEIGHT}
            data={trend.map((point) => point.value)}
            curveType="monotone"
            color="var(--mantine-primary-color-filled)"
            fillOpacity={0.15}
            strokeWidth={1.5}
            withGradient
        />
    );
}

/** The same numbers as the sparkline, with axes and a tooltip. */
export function MetricDetailChart({
    metric,
    trend,
    h = DETAIL_HEIGHT,
    program
}: {
    metric: MetricDefinition;
    trend: TrendPoint[];
    /** Taller when the chart is the page's own, not a hover panel's. */
    h?: number;
    /** Shades the competition season; omitted in the tile hover panels. */
    program?: Program;
}): ReactNode {
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
            series={[
                {
                    name: "value",
                    label: metric.detailLabel,
                    color: "var(--mantine-primary-color-filled)"
                }
            ]}
        >
            {program && <SeasonBands program={program} points={trend} />}
        </LineChart>
    );
}

/** Inserts split by library — the one trend that is genuinely multi-series. */
export function LibraryInsertsChart({
    series,
    h = DETAIL_HEIGHT,
    program,
    granularity
}: {
    series: DailyInsertPoint[];
    /** Taller when the chart is the page's own, not a hover panel's. */
    h?: number;
    /** Shades the competition season; omitted in the tile hover panels. */
    program?: Program;
    /** Overrides the granularity picked from the span. */
    granularity?: Granularity;
}): ReactNode {
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
            series={libraryIds.map((libraryId) => ({
                name: getLibraryName(libraryId),
                color: `${getLibraryColor(libraryId)}.6`
            }))}
        >
            {program && <SeasonBands program={program} points={data} />}
        </LineChart>
    );
}

/**
 * This season's cumulative uses laid over last season's, by week since kickoff.
 *
 * The gap between the two lines is the year-over-year change — the same story
 * the season tile tells as a percentage, but readable at every week rather
 * than only at today.
 */
export function SeasonCurveChart({
    curve,
    h = DETAIL_HEIGHT
}: {
    curve: SeasonCurveOut;
    h?: number;
}): ReactNode {
    return (
        <LineChart
            h={h}
            data={curve.points}
            dataKey="week"
            // The current line ends where the season has got to; joining it to
            // nothing would draw a season that has not happened yet.
            connectNulls={false}
            curveType="monotone"
            withDots={false}
            withLegend
            xAxisLabel="Weeks since kickoff"
            yAxisLabel="Uses so far"
            series={[
                {
                    name: "current",
                    label: curve.label,
                    color: "var(--mantine-primary-color-filled)"
                },
                {
                    name: "previous",
                    label: curve.baselineLabel,
                    color: "gray.5"
                }
            ]}
        />
    );
}

/**
 * Season bands, clipped to the buckets the chart actually plots.
 *
 * A `ReferenceArea` on a category axis matches by exact category value, so a
 * season only draws where its first and last bucket are both on the axis —
 * hence charting on `bucket` rather than the formatted label.
 */
function SeasonBands({
    program,
    points
}: {
    program: Program;
    points: BucketPoint[];
}): ReactNode {
    if (points.length === 0) return null;
    const buckets = points.map((point) => point.bucket);
    const first = buckets[0];
    const last = buckets[buckets.length - 1];

    return (
        <>
            {seasonsBetween(program, first, last).map((season) => {
                // Bands are drawn per bucket, so a season starting mid-bucket
                // clamps to the one containing it rather than vanishing.
                const from = buckets.find(
                    (bucket) => bucket >= season.from.slice(0, bucket.length)
                );
                const to = [...buckets]
                    .reverse()
                    .find(
                        (bucket) => bucket <= season.to.slice(0, bucket.length)
                    );
                if (from === undefined || to === undefined || from > to) {
                    return null;
                }
                return (
                    <ReferenceArea
                        key={season.label}
                        x1={from}
                        x2={to}
                        fill="var(--mantine-primary-color-filled)"
                        fillOpacity={0.07}
                        label={{
                            value: season.label,
                            position: "insideTop",
                            fontSize: 11,
                            fill: "var(--mantine-color-dimmed)"
                        }}
                    />
                );
            })}
        </>
    );
}

/** Ticks show the label; bands match the raw key the axis is actually keyed on. */
function toLabel(points: BucketPoint[]): (bucket: string) => string {
    const labels = new Map(points.map((point) => [point.bucket, point.label]));
    return (bucket) => labels.get(bucket) ?? bucket;
}

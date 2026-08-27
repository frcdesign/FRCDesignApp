import { LineChart, Sparkline } from "@mantine/charts";
import { type ReactNode } from "react";
import type { DailyInsertPoint } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { getLibraryColor } from "../../theme";
import { toChartData } from "./series-utils";
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
    trend
}: {
    metric: MetricDefinition;
    trend: TrendPoint[];
}): ReactNode {
    const share = isShare(metric);
    return (
        <LineChart
            h={DETAIL_HEIGHT}
            data={trend}
            dataKey="date"
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
        />
    );
}

/** Inserts split by library — the one trend that is genuinely multi-series. */
export function LibraryInsertsChart({
    series
}: {
    series: DailyInsertPoint[];
}): ReactNode {
    const libraryIds = Object.values(LibraryId);
    return (
        <LineChart
            h={DETAIL_HEIGHT}
            data={toChartData(series, libraryIds)}
            dataKey="date"
            withLegend
            withDots={series.length <= 45}
            curveType="monotone"
            yAxisLabel="Total uses"
            series={libraryIds.map((libraryId) => ({
                name: getLibraryName(libraryId),
                color: `${getLibraryColor(libraryId)}.6`
            }))}
        />
    );
}

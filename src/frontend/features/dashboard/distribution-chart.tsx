import { BarChart } from "@mantine/charts";
import { type ReactNode } from "react";
import type { Histogram } from "@backend/features/analytics/histogram";
import { binLabel } from "./distribution";
import { PrimaryColor } from "../../lib/style-constants";
import { m } from "../../paraglide/messages";
import { formatCount } from "./format";

// Imported here so the styles land in the dashboard's chunk.
import "@mantine/charts/styles.layer.css";

const DEFAULT_HEIGHT = 160;

/** Past this many bins, a range like "100–199" no longer fits level beside its neighbors. */
const MAX_LEVEL_LABELS = 6;

interface DistributionChartProps {
    histogram: Histogram;
    /** What a bar counts, which the y axis and the tooltip name. */
    countLabel: string;
    /** What the bins measure, for the x axis. */
    valueLabel: string;
    /** One thing to mark: its bar's share is drawn apart, under its own label. */
    mark?: { bin: number; label: string };
    /** In a small card: no y axis, whose counts the tooltip gives. */
    compact?: boolean;
    h?: number;
}

/**
 * How a measure spreads: a bar per bin. A marked thing is a second series
 * stacked into its bin, so it is named in the legend, not by color alone.
 */
export function DistributionChart(props: DistributionChartProps): ReactNode {
    const {
        histogram,
        countLabel,
        valueLabel,
        mark,
        compact = false,
        h = DEFAULT_HEIGHT
    } = props;
    const data = histogram.bins.map((bin, index) => {
        const marked = mark?.bin === index ? 1 : 0;
        return {
            bin: binLabel(bin, histogram.integer),
            others: bin.count - marked,
            marked
        };
    });
    return (
        <BarChart
            h={h}
            data={data}
            dataKey="bin"
            type="stacked"
            xAxisLabel={compact ? undefined : valueLabel}
            yAxisLabel={compact ? undefined : countLabel}
            withYAxis={!compact}
            withLegend={mark !== undefined}
            legendProps={{ verticalAlign: "top", height: 28 }}
            xAxisProps={
                data.length > MAX_LEVEL_LABELS
                    ? {
                          interval: 0,
                          fontSize: 11,
                          angle: -35,
                          textAnchor: "end",
                          height: 48
                      }
                    : { interval: 0, fontSize: 11 }
            }
            yAxisProps={{ allowDecimals: false }}
            valueFormatter={formatCount}
            series={[
                {
                    name: "others",
                    label: mark ? m.dashboardOthers() : countLabel,
                    color: PrimaryColor.FILLED
                },
                ...(mark
                    ? [{ name: "marked", label: mark.label, color: MARK_COLOR }]
                    : [])
            ]}
        />
    );
}

/** Apart from the primary green, and from the medals' metals. */
const MARK_COLOR = "blue.4";

import type {
    AnalyticsTotals,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    bucketBy,
    formatBucket,
    pickGranularity,
    type BucketPoint,
    type Granularity
} from "./series";

type MetricKey =
    | "inserts"
    | "fastenFraction"
    | "quickFraction"
    | "assemblyFraction";

/**
 * How one number is derived, formatted and trended, so a metric reads the same
 * way wherever it appears.
 */
export interface MetricDefinition {
    key: MetricKey;
    label: string;
    /** Shown under the info icon, with room to explain properly. */
    description: string;
    /** Names what is being counted, and what it is counted against. */
    numeratorLabel: string;
    denominatorLabel?: string;
    /** Percentages divide by `denominator`; counts leave it undefined. */
    numerator: (point: DailyMetricPoint) => number;
    denominator?: (point: DailyMetricPoint) => number;
    /** The all-time figure, shown as context beneath the range value. */
    lifetimeValue: (totals: AnalyticsTotals) => number;
    lifetimeDenominator?: (totals: AnalyticsTotals) => number;
    /** What the detail chart's y-axis is measuring. */
    detailLabel: string;
}

export const METRICS: Record<MetricKey, MetricDefinition> = {
    inserts: {
        key: "inserts",
        label: "Total uses",
        description:
            "The total number of times a part was inserted by the app.",
        numeratorLabel: "Total uses",
        numerator: (point) => point.inserts,
        lifetimeValue: (totals) => totals.inserts,
        detailLabel: "Total uses"
    },
    fastenFraction: {
        key: "fastenFraction",
        label: "Insert and fasten",
        description:
            "The percentage of inserts into assemblies which are done using insert and fasten.",
        numeratorLabel: "Insert and fasten inserts",
        denominatorLabel: "Inserts into an assembly",
        numerator: (point) => point.fastenInserts,
        // Onshape only offers fasten on an assembly target.
        denominator: (point) => point.targets[ElementType.ASSEMBLY],
        lifetimeDenominator: (totals) => totals.targets[ElementType.ASSEMBLY],
        lifetimeValue: (totals) => totals.fastenInserts,
        detailLabel: "% of assembly inserts"
    },
    quickFraction: {
        key: "quickFraction",
        label: "Quick insert",
        description:
            "The percentage of inserts which are done via the right click context menu.",
        numeratorLabel: "Quick inserts",
        denominatorLabel: "All inserts",
        numerator: (point) => point.quickInserts,
        denominator: (point) => point.inserts,
        lifetimeDenominator: (totals) => totals.inserts,
        lifetimeValue: (totals) => totals.quickInserts,
        detailLabel: "% of inserts"
    },
    assemblyFraction: {
        key: "assemblyFraction",
        label: "Into an assembly",
        description:
            "The percentage of inserts into an assembly (as opposed to a part studio).",
        numeratorLabel: "Inserts into an assembly",
        denominatorLabel: "All inserts",
        numerator: (point) => point.targets[ElementType.ASSEMBLY],
        denominator: (point) => point.inserts,
        lifetimeValue: (totals) => totals.targets[ElementType.ASSEMBLY],
        lifetimeDenominator: (totals) => totals.inserts,
        detailLabel: "% of inserts"
    }
};

/** The raw numerator and denominator behind a range value. */
export interface MetricTerms {
    numerator: number;
    denominator: number;
}

/** The totals the range value is computed from, for showing the workings. */
export function rangeTerms(
    points: DailyMetricPoint[],
    metric: MetricDefinition
): MetricTerms {
    let numerator = 0;
    let denominator = 0;
    for (const point of points) {
        numerator += metric.numerator(point);
        denominator += metric.denominator?.(point) ?? 0;
    }
    return { numerator, denominator };
}

/**
 * Folded from the same points the sparkline plots, so a tile can never disagree
 * with the chart behind it.
 */
function metricValue(
    { numerator, denominator }: MetricTerms,
    metric: MetricDefinition
): number {
    if (!metric.denominator) {
        return numerator;
    }
    return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

export function rangeValue(
    points: DailyMetricPoint[],
    metric: MetricDefinition
): number {
    return metricValue(rangeTerms(points, metric), metric);
}

/** True when the metric reads as a percentage rather than a count. */
export function isPercentage(metric: MetricDefinition): boolean {
    return metric.denominator !== undefined;
}

export interface TrendPoint extends BucketPoint {
    value: number;
}

/**
 * The value per bucket. Shares are ratioed after bucketing, or an average of
 * daily percentages would over-weight quiet days.
 */
export function toTrend(
    points: DailyMetricPoint[],
    metric: MetricDefinition,
    granularity: Granularity = pickGranularity(points.map((p) => p.day))
): TrendPoint[] {
    return bucketBy(
        points,
        granularity,
        (): MetricTerms => ({ numerator: 0, denominator: 0 }),
        (terms, point) => {
            terms.numerator += metric.numerator(point);
            terms.denominator += metric.denominator?.(point) ?? 0;
        }
    ).map(({ bucket, totals }) => ({
        bucket,
        label: formatBucket(bucket, granularity),
        value: metricValue(totals, metric)
    }));
}

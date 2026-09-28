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

export interface MetricDefinition {
    key: MetricKey;
    label: string;
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
        numerator: (point) => point.inserts,
        lifetimeValue: (totals) => totals.inserts,
        detailLabel: "Total uses"
    },
    fastenFraction: {
        key: "fastenFraction",
        label: "Insert and fasten",
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
        numerator: (point) => point.quickInserts,
        denominator: (point) => point.inserts,
        lifetimeDenominator: (totals) => totals.inserts,
        lifetimeValue: (totals) => totals.quickInserts,
        detailLabel: "% of inserts"
    },
    assemblyFraction: {
        key: "assemblyFraction",
        label: "Into an assembly",
        numerator: (point) => point.targets[ElementType.ASSEMBLY],
        denominator: (point) => point.inserts,
        lifetimeValue: (totals) => totals.targets[ElementType.ASSEMBLY],
        lifetimeDenominator: (totals) => totals.inserts,
        detailLabel: "% of inserts"
    }
};

/** The raw numerator and denominator behind a range value. */
interface MetricTerms {
    numerator: number;
    denominator: number;
}

/** The totals {@link rangeValue} divides. */
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

/** From the sparkline's points, so a tile can't disagree with its chart. */
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

export function isPercentage(metric: MetricDefinition): boolean {
    return metric.denominator !== undefined;
}

export interface TrendPoint extends BucketPoint {
    value: number;
}

/** Shares are computed after bucketing, or quiet days would be over-weighted. */
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

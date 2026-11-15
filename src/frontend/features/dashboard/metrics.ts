import type { DailyMetricPoint } from "@backend/features/analytics/contract";
import { UseTarget } from "@backend/features/analytics/usage";
import { m } from "../../paraglide/messages";
import {
    bucketBy,
    formatBucket,
    pickGranularity,
    type BucketPoint,
    type Granularity
} from "./series";

type MetricKey =
    | "uses"
    | "fastenFraction"
    | "assemblyFraction"
    | "downloadFraction";

export interface MetricDefinition {
    key: MetricKey;
    label: string;
    /** Percentages divide by `denominator`; counts leave it undefined. */
    numerator: (point: DailyMetricPoint) => number;
    denominator?: (point: DailyMetricPoint) => number;
    /** What the detail chart's y-axis is measuring. */
    detailLabel: string;
}

export const METRICS: Record<MetricKey, MetricDefinition> = {
    uses: {
        key: "uses",
        label: m.dashboardMetricUses(),
        numerator: (point) => point.uses,
        detailLabel: m.dashboardMetricUses()
    },
    fastenFraction: {
        key: "fastenFraction",
        label: m.dashboardMetricFasten(),
        numerator: (point) => point.fastenInserts,
        // Only the uses that could have fastened: into an assembly, of a part that offers it.
        denominator: (point) => point.fastenableUses,
        detailLabel: m.dashboardMetricOfFastenable()
    },
    assemblyFraction: {
        key: "assemblyFraction",
        label: m.dashboardMetricIntoAssembly(),
        numerator: (point) => point.targets[UseTarget.ASSEMBLY],
        denominator: (point) => point.uses,
        detailLabel: m.dashboardMetricOfUses()
    },
    downloadFraction: {
        key: "downloadFraction",
        label: m.dashboardMetricDownloaded(),
        numerator: (point) => point.targets[UseTarget.DOWNLOAD],
        denominator: (point) => point.uses,
        detailLabel: m.dashboardMetricOfUses()
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

/** From the series' points, so a tile can't disagree with a chart of them. */
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

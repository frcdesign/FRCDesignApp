import type {
    AnalyticsTotals,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import {
    formatBucket,
    pickGranularity,
    toBucketKey,
    type BucketPoint,
    type Granularity
} from "./series";

export type MetricKey =
    | "inserts"
    | "fastenShare"
    | "quickShare"
    | "deriveShare";

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
            "Every part inserted into a document from the library, counted once per insert. Quick inserts and inserts from the insert menu both count, and inserting the same part twice counts twice.",
        numeratorLabel: "Total uses",
        numerator: (point) => point.inserts,
        lifetimeValue: (totals) => totals.inserts,
        detailLabel: "Total uses"
    },
    fastenShare: {
        key: "fastenShare",
        label: "Insert and fasten",
        description:
            "How often people use insert and fasten instead of inserting and mating by hand. Onshape only offers it when the open tab is an assembly, so part-studio inserts are left out of the denominator entirely \u2014 otherwise this would mostly track how much assembly work was happening.",
        numeratorLabel: "Inserts that also fastened",
        denominatorLabel: "Inserts into an assembly",
        numerator: (point) => point.fastenInserts,
        // Onshape only offers fasten on an assembly target.
        denominator: (point) => point.assemblyInserts,
        lifetimeDenominator: (totals) => totals.assemblyInserts,
        lifetimeValue: (totals) => totals.fastenInserts,
        detailLabel: "% of assembly inserts"
    },
    quickShare: {
        key: "quickShare",
        label: "Quick insert",
        description:
            "How often people insert straight from a card\u2019s context menu rather than opening the insert menu. A low share on a configurable part is expected, since choosing values needs the menu.",
        numeratorLabel: "Quick inserts",
        denominatorLabel: "All inserts",
        numerator: (point) => point.quickInserts,
        denominator: (point) => point.inserts,
        lifetimeDenominator: (totals) => totals.inserts,
        lifetimeValue: (totals) => totals.quickInserts,
        detailLabel: "% of inserts"
    },
    deriveShare: {
        key: "deriveShare",
        label: "Derived into a part studio",
        description:
            "How often a part is derived into a part studio rather than inserted into an assembly. A library people derive from is being used as a starting point to modify; one people insert into assemblies is being used as finished hardware.",
        numeratorLabel: "Inserts into a part studio",
        denominatorLabel: "All inserts",
        numerator: (point) => point.inserts - point.assemblyInserts,
        denominator: (point) => point.inserts,
        lifetimeValue: (totals) => totals.inserts - totals.assemblyInserts,
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
export function rangeValue(
    points: DailyMetricPoint[],
    metric: MetricDefinition
): number {
    const { numerator, denominator } = rangeTerms(points, metric);

    if (metric.denominator) {
        return denominator === 0 ? 0 : (numerator / denominator) * 100;
    }
    return numerator;
}

/** True when the metric is a share rather than a count. */
export function isShare(metric: MetricDefinition): boolean {
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
    const buckets = new Map<
        string,
        { numerator: number; denominator: number; days: number }
    >();
    for (const point of points) {
        const key = toBucketKey(point.day, granularity);
        const bucket = buckets.get(key) ?? {
            numerator: 0,
            denominator: 0,
            days: 0
        };
        bucket.numerator += metric.numerator(point);
        bucket.denominator += metric.denominator?.(point) ?? 0;
        bucket.days += 1;
        buckets.set(key, bucket);
    }

    return [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucket, totals]) => ({
            bucket,
            label: formatBucket(bucket, granularity),
            value: bucketValue(totals, metric)
        }));
}

function bucketValue(
    bucket: { numerator: number; denominator: number; days: number },
    metric: MetricDefinition
): number {
    if (metric.denominator) {
        if (bucket.denominator === 0) return 0;
        return Math.round((bucket.numerator / bucket.denominator) * 1000) / 10;
    }
    return bucket.numerator;
}

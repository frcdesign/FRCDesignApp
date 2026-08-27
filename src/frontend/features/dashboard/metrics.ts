import type {
    AnalyticsTotals,
    DailyMetricPoint
} from "@backend/features/analytics/contract";

/**
 * Above this many days, points are bucketed by month so a sparkline stays
 * readable and a detail chart doesn't turn into noise.
 */
const MONTHLY_BUCKET_THRESHOLD = 120;

export type MetricKey =
    | "inserts"
    | "appOpens"
    | "activeUsers"
    | "favoriteShare"
    | "fastenShare"
    | "quickShare";

/**
 * How one number is derived, formatted and trended.
 *
 * Every tile and every detail chart is built from one of these, so a metric
 * reads the same way wherever it appears.
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
    /**
     * Daily counts add up over a bucket; a distinct-user count does not, so it
     * averages instead.
     */
    aggregate: "sum" | "average";
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
        aggregate: "sum",
        detailLabel: "Total uses"
    },
    appOpens: {
        key: "appOpens",
        label: "App opens",
        description:
            "Times the panel was opened in Onshape. Opening a second document tab counts again, as does reloading, so this tracks reach rather than distinct sessions.",
        numeratorLabel: "App opens",
        numerator: (point) => point.appOpens,
        lifetimeValue: (totals) => totals.appOpens,
        aggregate: "sum",
        detailLabel: "App opens"
    },
    activeUsers: {
        key: "activeUsers",
        label: "Active users",
        // Averaged, not summed: the tile is the mean of the plotted series, so
        // it measures the same thing the trend does. A distinct count over the
        // whole range would be a different (larger) number than any point on
        // the line, which is what made the old tile disagree with its chart.
        description:
            "How many distinct people used the app on a typical day in this range. Averaged across the days rather than summed, since the same person active all week is one user, not seven. The all-time figure below counts each person once, ever.",
        numeratorLabel: "Active users per day",
        numerator: (point) => point.activeUsers,
        lifetimeValue: (totals) => totals.uniqueUsers,
        aggregate: "average",
        detailLabel: "Active users per day"
    },
    favoriteShare: {
        key: "favoriteShare",
        label: "Favorited parts",
        description:
            "How often people insert a part they had favorited. This is a property of the part, not of where the insert came from \u2014 a favorited part inserted from search still counts here. Use \u201cWhere inserts start\u201d for the favorites list itself.",
        numeratorLabel: "Inserts of a favorited part",
        denominatorLabel: "All inserts",
        numerator: (point) => point.favoriteInserts,
        denominator: (point) => point.inserts,
        lifetimeDenominator: (totals) => totals.inserts,
        lifetimeValue: (totals) => totals.favoriteInserts,
        aggregate: "sum",
        detailLabel: "% of inserts"
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
        aggregate: "sum",
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
        aggregate: "sum",
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
 * The metric's value across the whole range.
 *
 * Derived from the same points the sparkline plots and folded by the metric's
 * own rule, so a tile can never disagree with the chart behind it.
 */
export function rangeValue(
    points: DailyMetricPoint[],
    metric: MetricDefinition
): number {
    const { numerator, denominator } = rangeTerms(points, metric);

    if (metric.denominator) {
        return denominator === 0 ? 0 : (numerator / denominator) * 100;
    }
    if (metric.aggregate === "average") {
        return points.length === 0 ? 0 : Math.round(numerator / points.length);
    }
    return numerator;
}

/** True when the metric is a share rather than a count. */
export function isShare(metric: MetricDefinition): boolean {
    return metric.denominator !== undefined;
}

export interface TrendPoint {
    /** Bucket label for the x-axis. */
    date: string;
    value: number;
}

/**
 * The metric's value per bucket across the range.
 *
 * Shares are ratioed after bucketing, so a month reads as its true share rather
 * than an average of daily percentages, which would over-weight quiet days.
 */
export function toTrend(
    points: DailyMetricPoint[],
    metric: MetricDefinition
): TrendPoint[] {
    const monthly = points.length > MONTHLY_BUCKET_THRESHOLD;

    const buckets = new Map<
        string,
        { numerator: number; denominator: number; days: number }
    >();
    for (const point of points) {
        const key = monthly ? point.day.slice(0, 7) : point.day;
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
        .map(([key, bucket]) => ({
            date: formatBucket(key, monthly),
            value: bucketValue(bucket, metric)
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
    if (metric.aggregate === "average") {
        return bucket.days === 0
            ? 0
            : Math.round(bucket.numerator / bucket.days);
    }
    return bucket.numerator;
}

function formatBucket(key: string, monthly: boolean): string {
    const parsed = new Date(monthly ? `${key}-01` : key);
    return parsed.toLocaleDateString("en-US", {
        month: "short",
        ...(monthly ? { year: "numeric" } : { day: "numeric" }),
        timeZone: "UTC"
    });
}

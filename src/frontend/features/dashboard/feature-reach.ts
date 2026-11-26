import {
    ReachInterval,
    splitsNewUsers,
    type FeatureReachOut
} from "@backend/features/analytics/contract";
import { AppFeature } from "@backend/features/analytics/usage";
import { addDays, toWeekStart } from "@backend/features/analytics/day";
import { formatBucket, Granularity, type BucketPoint } from "./series";
import {
    NUDGES,
    nudgeLabel,
    RELEASES,
    releaseLabel,
    type Nudge,
    type Release
} from "./nudges";
import { m } from "../../paraglide/messages";

/** One group's part of a day or week: how many used the feature, of how many about. */
export interface ReachCount {
    users: number;
    activeUsers: number;
    /** How many times they used it; undefined where that wasn't counted. */
    times?: number;
}

export interface ReachPoint extends BucketPoint, ReachCount {
    /**
     * In the feature's {@link ReachMeasure}; null for a time before its record
     * starts, a share of nobody, or where new users can't be told apart.
     */
    value: number | null;
    newValue: number | null;
    existingValue: number | null;
    /** Undefined where new users can't be told apart. */
    newCount?: ReachCount;
    existingCount?: ReachCount;
}

export enum ReachMeasure {
    /** The percentage of the day's or week's active users who used it. */
    SHARE = "share",
    /** How many times it was used that day or week. */
    TIMES = "times"
}

/** A range's share at or past this hides growth, which the times used show. */
export const TIMES_FROM_SHARE = 85;

/**
 * A report's times, since a share of people reporting reads as adoption.
 * Otherwise a share, unless it reaches {@link TIMES_FROM_SHARE} over the range
 * and the times are counted for all of it.
 */
export function reachMeasure(
    out: FeatureReachOut,
    feature: AppFeature
): ReachMeasure {
    if (feature === AppFeature.REPORT) return ReachMeasure.TIMES;
    const firstUsed = out.firstUsed[feature];
    if (!firstUsed) return ReachMeasure.SHARE;
    const firstBucket = bucketOf(firstUsed, out.interval);
    let users = 0;
    let activeUsers = 0;
    for (const bucket of out.buckets) {
        if (bucket.start < firstBucket) continue;
        users += bucket.users[feature] ?? 0;
        activeUsers += bucket.activeUsers;
    }
    if (activeUsers === 0) return ReachMeasure.SHARE;
    const share = (users / activeUsers) * 100;
    const rangeStart = out.buckets[0]?.start ?? firstBucket;
    const countedFrom = timesFrom(out, feature, firstBucket);
    return share >= TIMES_FROM_SHARE &&
        countedFrom <= (firstBucket > rangeStart ? firstBucket : rangeStart)
        ? ReachMeasure.TIMES
        : ReachMeasure.SHARE;
}

/** The first bucket whose times are all counted. */
function timesFrom(
    out: FeatureReachOut,
    feature: AppFeature,
    firstBucket: string
): string {
    const since = out.timesSince[feature];
    if (!since) return firstBucket;
    const full = firstWholeBucket(since, out.interval);
    return full > firstBucket ? full : firstBucket;
}

/** The first day or week that starts on or after a day. */
function firstWholeBucket(day: string, interval: ReachInterval): string {
    const start = bucketOf(day, interval);
    return start === day ? start : addDays(start, 7);
}

/** The day, or the Monday of the week, a day falls in. */
export function bucketOf(day: string, interval: ReachInterval): string {
    switch (interval) {
        case ReachInterval.DAY:
            return day;
        case ReachInterval.WEEK:
            return toWeekStart(day);
    }
}

function granularityOf(interval: ReachInterval): Granularity {
    switch (interval) {
        case ReachInterval.DAY:
            return Granularity.DAY;
        case ReachInterval.WEEK:
            return Granularity.WEEK;
    }
}

/** One feature's use a day or a week in its measure, all and split by new and existing. */
export function toReachSeries(
    out: FeatureReachOut,
    feature: AppFeature,
    measure: ReachMeasure = reachMeasure(out, feature)
): ReachPoint[] {
    const firstUsed = out.firstUsed[feature];
    const firstBucket = firstUsed
        ? bucketOf(firstUsed, out.interval)
        : undefined;
    const countedFrom = firstBucket && timesFrom(out, feature, firstBucket);
    return out.buckets.map((bucket) => {
        const recorded =
            firstBucket !== undefined && bucket.start >= firstBucket;
        const counted =
            countedFrom !== undefined && bucket.start >= countedFrom;
        const all: ReachCount = {
            users: bucket.users[feature] ?? 0,
            activeUsers: bucket.activeUsers,
            times: counted ? (bucket.times[feature] ?? 0) : undefined
        };
        const newCount: ReachCount | undefined =
            bucket.newActiveUsers === undefined || !splitsNewUsers(feature)
                ? undefined
                : {
                      users: bucket.newUsers?.[feature] ?? 0,
                      activeUsers: bucket.newActiveUsers,
                      times: counted
                          ? (bucket.newTimes?.[feature] ?? 0)
                          : undefined
                  };
        const existingCount: ReachCount | undefined = newCount && {
            users: all.users - newCount.users,
            activeUsers: all.activeUsers - newCount.activeUsers,
            times:
                all.times === undefined || newCount.times === undefined
                    ? undefined
                    : all.times - newCount.times
        };
        const valueOf = (count: ReachCount | undefined) =>
            recorded && count ? measured(count, measure) : null;
        return {
            bucket: bucket.start,
            label: formatBucket(bucket.start, granularityOf(out.interval)),
            ...all,
            value: valueOf(all),
            newValue: valueOf(newCount),
            existingValue: valueOf(existingCount),
            newCount,
            existingCount
        };
    });
}

function measured(count: ReachCount, measure: ReachMeasure): number | null {
    switch (measure) {
        case ReachMeasure.TIMES:
            return count.times ?? null;
        case ReachMeasure.SHARE:
            return count.activeUsers > 0
                ? (count.users / count.activeUsers) * 100
                : null;
    }
}

/** The newest point with a value to state. */
export function latestPoint(points: ReachPoint[]): ReachPoint | undefined {
    return points.findLast((point) => point.value !== null);
}

/**
 * At most `max` buckets to label, evenly spaced and counted back from the
 * newest, so the latest point always has one.
 */
export function evenTicks(buckets: string[], max: number): string[] {
    if (buckets.length <= max) return buckets;
    const step = Math.ceil((buckets.length - 1) / (max - 1));
    return buckets.filter((_, i) => (buckets.length - 1 - i) % step === 0);
}

/** Recorded for its own sake, and not charted. */
const UNCHARTED: readonly AppFeature[] = [AppFeature.DEFAULT_CONFIGURATION];

/** Nudged features first, in the order their nudges shipped, so the ones being pushed lead. */
export function featureOrder(): AppFeature[] {
    const nudged = [...new Set(NUDGES.map((nudge) => nudge.feature))];
    const rest = Object.values(AppFeature).filter(
        (feature) => !nudged.includes(feature)
    );
    return [...nudged, ...rest].filter(
        (feature) => !UNCHARTED.includes(feature)
    );
}

/**
 * A marker per day or week the feature, or a way to reach it, was released or
 * a nudge toward it changed in, where the chart has it. A nudge changed the
 * day of a release came with it, so the marker names the release alone.
 */
export function featureMarks(
    feature: AppFeature,
    points: ReachPoint[],
    interval: ReachInterval,
    releases: readonly Release[] = RELEASES,
    nudges: readonly Nudge[] = NUDGES
): { bucket: string; label: string }[] {
    const buckets = new Set(points.map((point) => point.bucket));
    const labels = new Map<string, string[]>();
    const mark = (day: string, label: string) => {
        const bucket = bucketOf(day, interval);
        if (!buckets.has(bucket)) return;
        labels.set(bucket, [...(labels.get(bucket) ?? []), label]);
    };
    const own = releases.filter((release) => release.feature === feature);
    const releaseDays = new Set(own.map((release) => release.day));
    for (const release of own) mark(release.day, releaseLabel(release));
    for (const nudge of nudges) {
        if (nudge.feature !== feature || nudge.day === undefined) continue;
        if (releaseDays.has(nudge.day)) continue;
        mark(nudge.day, nudgeLabel(nudge));
    }
    return [...labels.entries()].map(([bucket, names]) => ({
        bucket,
        label: names.join(" · ")
    }));
}

/** A marker label's average character width at 12px, near enough to tell two apart. */
const LABEL_CHAR_WIDTH = 6.5;
/** Between a label and its line, and the least between two labels on a row. */
const LABEL_GAP = 6;

export enum MarkSide {
    LEFT = "left",
    RIGHT = "right"
}

export interface PlacedMark {
    bucket: string;
    label: string;
    /** Toward the middle, so a label at either end stays on the card. */
    side: MarkSide;
    /** Rows down from the top, so labels that would touch stack instead. */
    row: number;
}

/**
 * Gives each marker the highest row its label fits on without touching
 * another, `plotWidth` being the pixels between the first and last buckets.
 */
export function placeMarks(
    marks: { bucket: string; label: string }[],
    buckets: string[],
    plotWidth: number
): PlacedMark[] {
    const last = Math.max(buckets.length - 1, 1);
    const rows: [number, number][][] = [];
    const placed = marks
        .map((mark) => {
            const index = buckets.indexOf(mark.bucket);
            const x = (index / last) * plotWidth;
            const side = index > last / 2 ? MarkSide.LEFT : MarkSide.RIGHT;
            return { ...mark, x, side };
        })
        .sort((a, b) => a.x - b.x);
    return placed.map(({ x, ...mark }) => {
        const width = mark.label.length * LABEL_CHAR_WIDTH;
        const span: [number, number] =
            mark.side === MarkSide.RIGHT
                ? [x + LABEL_GAP, x + LABEL_GAP + width]
                : [x - LABEL_GAP - width, x - LABEL_GAP];
        const free = (row: [number, number][]) =>
            row.every(
                ([start, end]) =>
                    span[1] + LABEL_GAP <= start || span[0] >= end + LABEL_GAP
            );
        let row = rows.findIndex(free);
        if (row === -1) {
            row = rows.length;
            rows.push([]);
        }
        rows[row].push(span);
        return { ...mark, row };
    });
}

export function featureLabel(feature: AppFeature): string {
    switch (feature) {
        case AppFeature.SEARCH:
            return m.dashboardFeatureSearch();
        case AppFeature.FAVORITES:
            return m.dashboardFeatureFavorites();
        case AppFeature.RECENTS:
            return m.dashboardFeatureRecents();
        case AppFeature.QUICK_INSERT:
            return m.dashboardFeatureQuickInsert();
        case AppFeature.FASTEN:
            return m.dashboardFeatureFasten();
        case AppFeature.PRESELECTION:
            return m.dashboardFeaturePreselection();
        case AppFeature.AUTO_ASSEMBLY:
            return m.dashboardFeatureAutoAssembly();
        case AppFeature.INSERT_LOCATION:
            return m.dashboardFeatureInsertLocation();
        case AppFeature.DOWNLOAD:
            return m.dashboardFeatureDownload();
        case AppFeature.DEFAULT_CONFIGURATION:
            return m.dashboardFeatureDefaultConfiguration();
        case AppFeature.VERSION_MANAGER:
            return m.dashboardFeatureVersionManager();
        case AppFeature.FEATURESCRIPTS:
            return m.dashboardFeatureFeatureScripts();
        case AppFeature.MASS_ANALYSIS:
            return m.dashboardFeatureMassAnalysis();
        case AppFeature.REPORT:
            return m.dashboardFeatureReport();
    }
}

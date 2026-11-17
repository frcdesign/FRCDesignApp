import type { FeatureReachOut } from "@backend/features/analytics/contract";
import { AppFeature } from "@backend/features/analytics/usage";
import { toWeekStart } from "@backend/features/analytics/day";
import { formatBucket, Granularity, type BucketPoint } from "./series";
import { NUDGES, nudgeLabel, type Nudge } from "./nudges";
import { m } from "../../paraglide/messages";

/** One group's part of a week: how many used the feature, of how many about. */
export interface ReachCount {
    users: number;
    activeUsers: number;
}

export interface ReachPoint extends BucketPoint, ReachCount {
    /**
     * In the feature's {@link ReachMeasure}; null for a week before its record
     * starts, a share of nobody, or where new users can't be told apart.
     */
    value: number | null;
    newValue: number | null;
    existingValue: number | null;
    /** Undefined where new users can't be told apart. */
    newCount?: ReachCount;
    existingCount?: ReachCount;
}

/** Which lines each feature's chart draws; kept in the url. */
export enum ReachView {
    ALL = "all",
    NEW_VS_EXISTING = "new-vs-existing"
}

export enum ReachMeasure {
    /** The percentage of the week's active users who used it. */
    SHARE = "share",
    /** How many people used it that week. */
    USERS = "users"
}

/**
 * Counted where a share says little: nobody should need to report an issue or
 * download a part, and nearly everybody searches.
 */
export function featureMeasure(feature: AppFeature): ReachMeasure {
    switch (feature) {
        case AppFeature.SEARCH:
        case AppFeature.DOWNLOAD:
        case AppFeature.REPORT:
            return ReachMeasure.USERS;
        case AppFeature.FAVORITES:
        case AppFeature.RECENTS:
        case AppFeature.QUICK_INSERT:
        case AppFeature.FASTEN:
        case AppFeature.PRESELECTION:
        case AppFeature.INSERT_LOCATION:
        case AppFeature.AUTO_ASSEMBLY:
        case AppFeature.DEFAULT_CONFIGURATION:
        case AppFeature.VERSION_MANAGER:
        case AppFeature.FEATURESCRIPTS:
            return ReachMeasure.SHARE;
    }
}

/** One feature's weekly use in its measure, all and split by new and existing. */
export function toReachSeries(
    out: FeatureReachOut,
    feature: AppFeature,
    measure: ReachMeasure = featureMeasure(feature)
): ReachPoint[] {
    const firstUsed = out.firstUsed[feature];
    const firstWeek = firstUsed ? toWeekStart(firstUsed) : undefined;
    return out.weeks.map((week) => {
        const recorded = firstWeek !== undefined && week.week >= firstWeek;
        const all: ReachCount = {
            users: week.users[feature] ?? 0,
            activeUsers: week.activeUsers
        };
        const newCount: ReachCount | undefined =
            week.newActiveUsers === undefined
                ? undefined
                : {
                      users: week.newUsers?.[feature] ?? 0,
                      activeUsers: week.newActiveUsers
                  };
        const existingCount: ReachCount | undefined = newCount && {
            users: all.users - newCount.users,
            activeUsers: all.activeUsers - newCount.activeUsers
        };
        const valueOf = (count: ReachCount | undefined) =>
            recorded && count ? measured(count, measure) : null;
        return {
            bucket: week.week,
            label: formatBucket(week.week, Granularity.WEEK),
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
        case ReachMeasure.USERS:
            return count.users;
        case ReachMeasure.SHARE:
            return count.activeUsers > 0
                ? (count.users / count.activeUsers) * 100
                : null;
    }
}

/** The newest week with a value to state. */
export function latestPoint(points: ReachPoint[]): ReachPoint | undefined {
    return points.findLast((point) => point.value !== null);
}

/**
 * At most `max` buckets to label, evenly spaced and counted back from the
 * newest, so the latest week always has one.
 */
export function evenTicks(buckets: string[], max: number): string[] {
    if (buckets.length <= max) return buckets;
    const step = Math.ceil((buckets.length - 1) / (max - 1));
    return buckets.filter((_, i) => (buckets.length - 1 - i) % step === 0);
}

/** Nudged features first, in the order their nudges shipped, so the ones being pushed lead. */
export function featureOrder(): AppFeature[] {
    const nudged = [...new Set(NUDGES.map((nudge) => nudge.feature))];
    const rest = Object.values(AppFeature).filter(
        (feature) => !nudged.includes(feature)
    );
    return [...nudged, ...rest];
}

/** A marker per week the feature's nudges changed in, on the week the chart has. */
export function nudgeMarks(
    feature: AppFeature,
    points: ReachPoint[],
    nudges: readonly Nudge[] = NUDGES
): { bucket: string; label: string }[] {
    const buckets = new Set(points.map((point) => point.bucket));
    const labels = new Map<string, string[]>();
    for (const nudge of nudges) {
        if (nudge.feature !== feature || nudge.day === undefined) continue;
        const week = toWeekStart(nudge.day);
        if (!buckets.has(week)) continue;
        labels.set(week, [...(labels.get(week) ?? []), nudgeLabel(nudge)]);
    }
    return [...labels.entries()].map(([bucket, names]) => ({
        bucket,
        label: names.join(" · ")
    }));
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
        case AppFeature.REPORT:
            return m.dashboardFeatureReport();
    }
}

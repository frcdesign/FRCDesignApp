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
     * Percentages; null for a week before the feature's record starts, with
     * nobody in the group about, or where new users can't be told apart.
     */
    reach: number | null;
    newReach: number | null;
    existingReach: number | null;
    /** Undefined where new users can't be told apart. */
    newCount?: ReachCount;
    existingCount?: ReachCount;
}

/** Which lines each feature's chart draws; kept in the url. */
export enum ReachView {
    ALL = "all",
    NEW_VS_EXISTING = "new-vs-existing"
}

/** One feature's weekly share of active users, all and split by new and existing. */
export function toReachSeries(
    out: FeatureReachOut,
    feature: AppFeature
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
        const share = (count: ReachCount | undefined) =>
            recorded && count && count.activeUsers > 0
                ? (count.users / count.activeUsers) * 100
                : null;
        return {
            bucket: week.week,
            label: formatBucket(week.week, Granularity.WEEK),
            ...all,
            reach: share(all),
            newReach: share(newCount),
            existingReach: share(existingCount),
            newCount,
            existingCount
        };
    });
}

/** The newest week with a share to state. */
export function latestReach(points: ReachPoint[]): ReachPoint | undefined {
    return points.findLast((point) => point.reach !== null);
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
        if (nudge.feature !== feature) continue;
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

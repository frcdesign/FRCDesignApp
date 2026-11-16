import type { FeatureReachOut } from "@backend/features/analytics/contract";
import { AppFeature } from "@backend/features/analytics/usage";
import { toWeekStart } from "@backend/features/analytics/day";
import { formatBucket, Granularity, type BucketPoint } from "./series";
import { NUDGES, nudgeLabel, type Nudge } from "./nudges";
import { m } from "../../paraglide/messages";

export interface ReachPoint extends BucketPoint {
    /** A percentage; null for a week before the feature's record starts, or with nobody about. */
    reach: number | null;
    users: number;
    activeUsers: number;
}

/** One feature's weekly share of active users. */
export function toReachSeries(
    out: FeatureReachOut,
    feature: AppFeature
): ReachPoint[] {
    const firstUsed = out.firstUsed[feature];
    const firstWeek = firstUsed ? toWeekStart(firstUsed) : undefined;
    return out.weeks.map(({ week, activeUsers, users }) => {
        const count = users[feature] ?? 0;
        const recorded = firstWeek !== undefined && week >= firstWeek;
        return {
            bucket: week,
            label: formatBucket(week, Granularity.WEEK),
            reach:
                recorded && activeUsers > 0
                    ? (count / activeUsers) * 100
                    : null,
            users: count,
            activeUsers
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

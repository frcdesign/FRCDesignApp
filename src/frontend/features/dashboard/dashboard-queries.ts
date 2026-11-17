import { queryOptions, type UseQueryResult } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import type {
    DailyUsePoint,
    FeatureReachOut,
    FeatureScriptUsageOut,
    LibrarySummaryOut,
    InsertableReportOut,
    LibraryHealthCounts,
    OverviewUsageOut,
    PartUsageOut,
    ReportSummary,
    UnusedOptionOut,
    UseSourceUsage,
    VersionManagerTotals
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { type DayRange } from "@backend/features/analytics/day";
import { toLibraryPath } from "../../lib/api-paths";

/** One overview area over `range`; each loads, and fails, on its own. */
function overviewQuery<T>(area: string, range: DayRange) {
    return queryOptions<T>({
        queryKey: ["analytics", "overview", area, range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/overview/" + area, {
                query: { from: range.from, to: range.to }
            })
    });
}

/** Totals over `range`; the sparklines and changes over `trend` when given. */
export function getOverviewUsageQuery(range: DayRange, trend?: DayRange) {
    return queryOptions<OverviewUsageOut>({
        queryKey: [
            "analytics",
            "overview",
            "usage",
            range.from,
            range.to,
            trend?.from
        ],
        queryFn: () =>
            apiGet("/analytics/overview/usage", {
                query: {
                    from: range.from,
                    to: range.to,
                    ...(trend ? { trendFrom: trend.from } : {})
                }
            })
    });
}

export function getOverviewSeriesQuery(range: DayRange) {
    return overviewQuery<DailyUsePoint[]>("series", range);
}

export function getOverviewSourcesQuery(range: DayRange) {
    return overviewQuery<UseSourceUsage[]>("sources", range);
}

export function getVersionManagerQuery(range: DayRange) {
    return overviewQuery<VersionManagerTotals>("version-manager", range);
}

export function getOverviewFeatureScriptsQuery(range: DayRange) {
    return overviewQuery<FeatureScriptUsageOut>("featurescripts", range);
}

export function getOverviewFeatureReachQuery(range: DayRange) {
    return overviewQuery<FeatureReachOut>("feature-reach", range);
}

/** Every library's together; it changes with a reload, not with the range. */
export function getOverviewHealthQuery() {
    return queryOptions<LibraryHealthCounts>({
        queryKey: ["analytics", "overview", "health"],
        queryFn: () => apiGet("/analytics/overview/health")
    });
}

export function getOverviewReportsQuery(range: DayRange) {
    return overviewQuery<ReportSummary>("reports", range);
}

export function getLibrarySummaryQuery(libraryId: LibraryId, range: DayRange) {
    return queryOptions<LibrarySummaryOut>({
        queryKey: ["analytics", "summary", libraryId, range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/summary" + toLibraryPath(libraryId), {
                query: { from: range.from, to: range.to }
            })
    });
}

/** The library's parts, counted over `range`. */
export function getPartsQuery(libraryId: LibraryId, range: DayRange) {
    return queryOptions<PartUsageOut[]>({
        queryKey: ["analytics", "parts", libraryId, range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/parts" + toLibraryPath(libraryId), {
                query: { from: range.from, to: range.to }
            })
    });
}

export function getUnusedQuery(
    libraryId: LibraryId,
    threshold: number,
    range: DayRange
) {
    return queryOptions<PartUsageOut[]>({
        queryKey: [
            "analytics",
            "unused",
            libraryId,
            threshold,
            range.from,
            range.to
        ],
        queryFn: () =>
            apiGet("/analytics/unused" + toLibraryPath(libraryId), {
                query: {
                    threshold: threshold.toString(),
                    from: range.from,
                    to: range.to
                }
            })
    });
}

export function getUnusedOptionsQuery(
    libraryId: LibraryId,
    threshold: number,
    range: DayRange
) {
    return queryOptions<UnusedOptionOut[]>({
        queryKey: [
            "analytics",
            "unused-options",
            libraryId,
            threshold,
            range.from,
            range.to
        ],
        queryFn: () =>
            apiGet("/analytics/unused-options" + toLibraryPath(libraryId), {
                query: {
                    threshold: threshold.toString(),
                    from: range.from,
                    to: range.to
                }
            })
    });
}

export function getInsertableReportQuery(
    libraryId: LibraryId,
    elementId: string,
    range: DayRange
) {
    return queryOptions<InsertableReportOut>({
        queryKey: [
            "analytics",
            "insertable",
            libraryId,
            elementId,
            range.from,
            range.to
        ],
        queryFn: () =>
            apiGet(
                "/analytics/insertable" +
                    toLibraryPath(libraryId) +
                    "/element/" +
                    elementId,
                { query: { from: range.from, to: range.to } }
            )
    });
}

/** Immutable for a version of the library, as the build status is. */
export function getHealthQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryHealthCounts>({
        queryKey: ["analytics", "health", libraryId, cacheVersion],
        queryFn: () =>
            apiGet("/analytics/health" + toLibraryPath(libraryId), {
                cacheId: cacheVersion
            }),
        staleTime: Infinity,
        gcTime: Infinity
    });
}

/** The first failure among several queries, else the first still loading. */
export function firstPending(
    queries: UseQueryResult<unknown>[]
): UseQueryResult<unknown> | undefined {
    return (
        queries.find((query) => query.isError) ??
        queries.find((query) => query.data === undefined)
    );
}

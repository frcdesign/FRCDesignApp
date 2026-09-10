import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import type {
    AnalyticsOverviewOut,
    LibrarySummaryOut,
    InsertableReportOut,
    LibraryHealthCounts,
    PartUsageOut,
    UnusedOptionOut
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { type DayRange } from "@backend/features/analytics/day";
import { toLibraryPath } from "../library/library-path";

export function getOverviewQuery(range: DayRange) {
    return queryOptions<AnalyticsOverviewOut>({
        queryKey: ["analytics", "overview", range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/overview", {
                query: { from: range.from, to: range.to }
            })
    });
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

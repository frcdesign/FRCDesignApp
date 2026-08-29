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
import { toLibraryPath } from "../library/library-path";

export interface DayRange {
    from: string;
    to: string;
}

export function toDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

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

/**
 * The library's parts, counted over `range`.
 *
 * The range is required rather than defaulted: a caller that forgets it would
 * silently inherit the API's own 30-day default and report a window nothing on
 * the page names.
 */
export function getPartsQuery(libraryId: LibraryId, range: DayRange) {
    return queryOptions<PartUsageOut[]>({
        queryKey: ["analytics", "parts", libraryId, range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/parts" + toLibraryPath(libraryId), {
                query: { from: range.from, to: range.to }
            })
    });
}

export function getUnusedQuery(libraryId: LibraryId, threshold: number) {
    return queryOptions<PartUsageOut[]>({
        queryKey: ["analytics", "unused", libraryId, threshold],
        queryFn: () =>
            apiGet("/analytics/unused" + toLibraryPath(libraryId), {
                query: { threshold: threshold.toString() }
            })
    });
}

export function getUnusedOptionsQuery(libraryId: LibraryId, threshold: number) {
    return queryOptions<UnusedOptionOut[]>({
        queryKey: ["analytics", "unused-options", libraryId, threshold],
        queryFn: () =>
            apiGet("/analytics/unused-options" + toLibraryPath(libraryId), {
                query: { threshold: threshold.toString() }
            })
    });
}

export function getInsertableReportQuery(
    libraryId: LibraryId,
    elementId: string
) {
    return queryOptions<InsertableReportOut>({
        queryKey: ["analytics", "insertable", libraryId, elementId],
        queryFn: () =>
            apiGet(
                "/analytics/insertable" +
                    toLibraryPath(libraryId) +
                    "/element/" +
                    elementId
            )
    });
}

export function getHealthQuery(libraryId: LibraryId) {
    return queryOptions<LibraryHealthCounts>({
        queryKey: ["analytics", "health", libraryId],
        queryFn: () => apiGet("/analytics/health" + toLibraryPath(libraryId))
    });
}

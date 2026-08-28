import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import type {
    AnalyticsOverviewOut,
    GroupUsageOut,
    InsertableReportOut,
    LibraryHealthOut,
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
    return queryOptions<AnalyticsOverviewOut>({
        queryKey: ["analytics", "summary", libraryId, range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/summary" + toLibraryPath(libraryId), {
                query: { from: range.from, to: range.to }
            })
    });
}

export function getPartsQuery(libraryId: LibraryId) {
    return queryOptions<PartUsageOut[]>({
        queryKey: ["analytics", "parts", libraryId],
        queryFn: () => apiGet("/analytics/parts" + toLibraryPath(libraryId))
    });
}

/** Insertions per group in the window, with each group's parts nested. */
export function getGroupUsageQuery(libraryId: LibraryId, range: DayRange) {
    return queryOptions<GroupUsageOut[]>({
        // The range is in the key: unlike the parts table, this one follows the
        // picker, so a new part is not drowned out by years of an old one.
        queryKey: ["analytics", "groups", libraryId, range.from, range.to],
        queryFn: () =>
            apiGet("/analytics/groups" + toLibraryPath(libraryId), {
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
    return queryOptions<LibraryHealthOut>({
        queryKey: ["analytics", "health", libraryId],
        queryFn: () => apiGet("/analytics/health" + toLibraryPath(libraryId))
    });
}

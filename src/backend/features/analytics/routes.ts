import { and, eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { getDb } from "../../db/client";
import { configurations, groups, insertables } from "../../db/schema";
import { insertableStats } from "./schema";
import type {
    AnalyticsOverviewOut,
    InsertableReportOut,
    LibrarySummaryOut,
    PartUsageOut,
    UnusedOptionOut
} from "./contract";
import { ParameterType } from "../configurations/models";
import { usesPerMonth } from "./measures";
import { getGrowth } from "./growth";
import { toElementPath } from "../../lib/onshape/path";
import { toDayKey } from "./tracking";
import { getHealthCounts } from "./health";
import { buildParameterUsage } from "./parameter-usage";
import {
    countPartFavorites,
    countPartUsers,
    getConfigurationCounts,
    getPartInsertable,
    getPartParameters,
    getPartSparklines,
    getPartStats,
    getWindowedInsertCounts,
    sumPartTargets,
    toWindowedPart
} from "./part-queries";
import {
    getLibrarySummaries,
    getMetricSeries,
    getSeries,
    getSources,
    getTotals,
    toTargets
} from "./metric-queries";
import {
    clampRange,
    getTrackingSince,
    rangeQuery,
    thresholdQuery
} from "./range";

export const analyticsRoutes = getApp();

/**
 * Every handler here is public, which in this app means never touching
 * `getUserId()` or `getOnshapeApi()`. Only aggregates leave — never a user id.
 */

/** GET /api/analytics/overview */
analyticsRoutes.get(
    "/analytics/overview",
    validate("query", rangeQuery),
    async (c) => {
        const db = getDb(c.env.DB);
        const requested = c.req.valid("query");
        const trackingSince = await getTrackingSince(db);
        // Series are densified, so they read the clamped range; the totals still
        // read what was asked for, where extra empty days cost nothing.
        const range = clampRange(requested, trackingSince);

        const [totals, perLibrary, series, metricSeries, sources, growth] =
            await Promise.all([
                getTotals(db),
                getLibrarySummaries(db),
                getSeries(db, range),
                getMetricSeries(db, range),
                getSources(db, requested),
                getGrowth(db, toDayKey(Date.now()), trackingSince)
            ]);

        const out: AnalyticsOverviewOut = {
            totals,
            libraries: perLibrary,
            series,
            metricSeries,
            sources,
            growth,
            ...requested
        };
        return c.json(out);
    }
);

/** GET /api/analytics/summary/library/:libraryId */
analyticsRoutes.get(
    "/analytics/summary" + libraryRoute(),
    validate("query", rangeQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        const requested = c.req.valid("query");
        const trackingSince = await getTrackingSince(db);
        const range = clampRange(requested, trackingSince);

        const [totals, metricSeries, growth] = await Promise.all([
            getTotals(db, libraryId),
            getMetricSeries(db, range, libraryId),
            getGrowth(db, toDayKey(Date.now()), trackingSince, libraryId)
        ]);

        const out: LibrarySummaryOut = {
            totals,
            metricSeries,
            growth,
            ...requested
        };
        return c.json(out);
    }
);

/** GET /api/analytics/health/library/:libraryId */
analyticsRoutes.get("/analytics/health" + libraryRoute(), async (c) => {
    const libraryId = getLibraryParam(c);
    const db = getDb(c.env.DB);
    return c.json(await getHealthCounts(db, libraryId));
});

/** GET /api/analytics/parts/library/:libraryId */
analyticsRoutes.get(
    "/analytics/parts" + libraryRoute(),
    validate("query", rangeQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        const range = c.req.valid("query");

        // Driven off the library, not the stats table: an unused part still lists
        // at zero, and one that has left the library does not list at all.
        const [rows, series, windowed] = await Promise.all([
            db
                .select({
                    elementId: insertables.elementId,
                    firstInsertedAt: insertableStats.firstInsertedAt,
                    name: insertables.name,
                    documentId: insertables.documentId,
                    versionId: insertables.versionId,
                    isVisible: insertables.isVisible,
                    groupName: groups.name
                })
                .from(insertables)
                .leftJoin(
                    insertableStats,
                    and(
                        eq(insertableStats.libraryId, insertables.libraryId),
                        eq(insertableStats.elementId, insertables.elementId)
                    )
                )
                // `groupId` is a non-null FK that cascades, so a row always matches.
                .innerJoin(groups, eq(groups.id, insertables.groupId))
                .where(eq(insertables.libraryId, libraryId))
                .all(),
            getPartSparklines(db, libraryId),
            getWindowedInsertCounts(db, libraryId, range)
        ]);

        const out: PartUsageOut[] = rows
            .map((row) => toWindowedPart(row, windowed, series, range))
            // Most used first; unused parts fall to the bottom in name order.
            .sort(
                (a, b) =>
                    b.usesPerMonth - a.usesPerMonth ||
                    a.name.localeCompare(b.name)
            );
        return c.json(out);
    }
);

/** GET /api/analytics/unused/library/:libraryId */
analyticsRoutes.get(
    "/analytics/unused" + libraryRoute(),
    validate("query", thresholdQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        const { threshold, ...range } = c.req.valid("query");

        // Drives off insertables (not the stats table) so parts with no events at
        // all — the ones that matter most here — are included.
        const [rows, series, windowed] = await Promise.all([
            db
                .select({
                    elementId: insertables.elementId,
                    name: insertables.name,
                    documentId: insertables.documentId,
                    versionId: insertables.versionId,
                    groupName: groups.name,
                    isVisible: insertables.isVisible,
                    firstInsertedAt: insertableStats.firstInsertedAt
                })
                .from(insertables)
                .leftJoin(
                    insertableStats,
                    and(
                        eq(insertableStats.libraryId, insertables.libraryId),
                        eq(insertableStats.elementId, insertables.elementId)
                    )
                )
                .innerJoin(groups, eq(groups.id, insertables.groupId))
                .where(
                    and(
                        eq(insertables.libraryId, libraryId),
                        eq(insertables.isVisible, true)
                    )
                )
                .all(),
            getPartSparklines(db, libraryId),
            getWindowedInsertCounts(db, libraryId, range)
        ]);

        const out: PartUsageOut[] = rows
            .map((row) => toWindowedPart(row, windowed, series, range))
            // Least used first: the point of the page is the bottom of the list.
            .filter((part) => part.insertCount <= threshold)
            .sort(
                (a, b) =>
                    a.insertCount - b.insertCount ||
                    a.name.localeCompare(b.name)
            );
        return c.json(out);
    }
);

/** GET /api/analytics/unused-options/library/:libraryId */
analyticsRoutes.get(
    "/analytics/unused-options" + libraryRoute(),
    validate("query", thresholdQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);
        const { threshold, ...range } = c.req.valid("query");

        const [parts, valueRows] = await Promise.all([
            db
                .select({
                    elementId: insertables.elementId,
                    documentId: insertables.documentId,
                    versionId: insertables.versionId,
                    name: insertables.name,
                    parameters: configurations.parameters
                })
                .from(insertables)
                .innerJoin(
                    configurations,
                    eq(configurations.id, insertables.id)
                )
                .where(
                    and(
                        eq(insertables.libraryId, libraryId),
                        eq(insertables.isVisible, true)
                    )
                )
                .all(),
            getConfigurationCounts(db, libraryId, range)
        ]);

        const byElement = Map.groupBy(valueRows, (row) => row.elementId);

        const out: UnusedOptionOut[] = [];
        for (const part of parts) {
            const usage = buildParameterUsage(
                part.parameters,
                byElement.get(part.elementId) ?? []
            );
            for (const parameter of usage) {
                // Only an enum declares the options it could have been given, so
                // only an enum can have one that was never picked.
                if (parameter.type !== ParameterType.ENUM) continue;
                for (const value of parameter.values) {
                    if (value.count > threshold) continue;
                    out.push({
                        path: toElementPath(part),
                        partName: part.name,
                        parameterId: parameter.parameterId,
                        parameterName: parameter.name,
                        value,
                        parameterTotal: parameter.total
                    });
                }
            }
        }

        // Never-picked first, then by how much of the parameter went elsewhere:
        // an option skipped on a heavily configured part is the stronger signal.
        out.sort(
            (a, b) =>
                a.value.count - b.value.count ||
                b.parameterTotal - a.parameterTotal ||
                a.partName.localeCompare(b.partName)
        );
        return c.json(out);
    }
);

/** GET /api/analytics/insertable/library/:libraryId/element/:elementId */
analyticsRoutes.get(
    "/analytics/insertable" + libraryRoute() + "/element/:elementId",
    validate("query", rangeQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const elementId = c.req.param("elementId")!;
        const db = getDb(c.env.DB);
        const range = c.req.valid("query");

        const [
            stats,
            insertable,
            valueRows,
            uniqueUsers,
            targetRows,
            favoriteCount
        ] = await Promise.all([
            getPartStats(db, libraryId, elementId),
            getPartInsertable(db, libraryId, elementId),
            getConfigurationCounts(db, libraryId, range, elementId),
            countPartUsers(db, libraryId, elementId, range),
            sumPartTargets(db, libraryId, elementId, range),
            countPartFavorites(db, libraryId, elementId)
        ]);

        const targets = toTargets(targetRows);
        const insertCount = Object.values(targets).reduce(
            (total, count) => total + count,
            0
        );
        // Rated over the days the part has existed inside the window, as the
        // parts table rates it.
        const windowStart = Date.parse(`${range.from}T00:00:00Z`);
        const windowEnd = Math.min(
            Date.now(),
            Date.parse(`${range.to}T23:59:59Z`)
        );
        const firstUsed = Math.max(
            stats?.firstInsertedAt?.getTime() ?? windowStart,
            windowStart
        );

        // Only a part still in the library has a report: its name, its path
        // and its parameters all come from the row that is no longer there.
        if (!insertable) {
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);
        }

        const parameters = await getPartParameters(db, insertable.id);

        const out: InsertableReportOut = {
            name: insertable.name,
            path: toElementPath({ ...insertable, elementId }),
            insertCount,
            usesPerMonth: usesPerMonth(
                insertCount,
                insertCount === 0 ? undefined : firstUsed,
                windowEnd
            ),
            uniqueUsers: uniqueUsers?.value ?? 0,
            favorites: favoriteCount?.value ?? 0,
            targets,
            parameters: buildParameterUsage(parameters, valueRows)
        };
        return c.json(out);
    }
);

import { asc, eq, inArray } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../cache";
import { getApp } from "../context";
import { getLibraryParam, libraryRoute } from "../route-params";
import { getDb } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import { group, insertables, configurations } from "../../shared/schema";
import type { LibraryBuildStatus, GroupBuildStatus, InsertableBuildStatus } from "../../shared/build-status-dto";

export const buildStatusRoutes = getApp();

/** GET /api/build-status/library/:libraryId?v=:cacheVersion */
buildStatusRoutes.get(
    "/build-status" + libraryRoute(),
    requireEditorMiddleware,
    cacheMiddleware(CachePolicy.PRIVATE_CACHE),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);

        const [allGroups, allInsertables] = await Promise.all([
            db
                .select({
                    id: group.id,
                    buildIssues: group.buildIssues,
                    sortAlphabetically: group.sortAlphabetically,
                    sortOrder: group.sortOrder,
                    lastLoadedAt: group.lastLoadedAt
                })
                .from(group)
                .where(eq(group.libraryId, libraryId))
                .orderBy(asc(group.sortOrder))
                .all(),
            db
                .select({
                    id: insertables.id,
                    groupId: insertables.groupId,
                    buildIssues: insertables.buildIssues,
                    elementType: insertables.elementType,
                    isVisible: insertables.isVisible,
                    supportsFasten: insertables.supportsFasten,
                    indexConfigurations: insertables.indexConfigurations,
                    vendors: insertables.vendors,
                    sortOrder: insertables.sortOrder,
                    lastLoadedAt: insertables.lastLoadedAt
                })
                .from(insertables)
                .where(eq(insertables.libraryId, libraryId))
                .orderBy(asc(insertables.sortOrder))
                .all()
        ]);

        const insertableIds = allInsertables.map((ins) => ins.id);
        const allConfigurations = await db
            .select({
                id: configurations.id,
                buildIssues: configurations.buildIssues,
                parameters: configurations.parameters
            })
            .from(configurations)
            .where(inArray(configurations.id, insertableIds))
            .all();

        const configMap = new Map(allConfigurations.map((c) => [c.id, c]));

        const groupsOut: Record<string, GroupBuildStatus> = {};
        for (const group of allGroups) {
            const groupInsertables = allInsertables
                .filter((ins) => ins.groupId === group.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
            groupsOut[group.id] = {
                buildIssues: group.buildIssues,
                sortAlphabetically: group.sortAlphabetically,
                insertableOrder: groupInsertables.map((ins) => ins.id),
                lastLoadedAt: group.lastLoadedAt
            };
        }

        const insertablesOut: Record<string, InsertableBuildStatus> = {};
        for (const ins of allInsertables) {
            const config = configMap.get(ins.id);
            insertablesOut[ins.id] = {
                buildIssues: ins.buildIssues,
                elementType: ins.elementType,
                isVisible: ins.isVisible,
                supportsFasten: ins.supportsFasten,
                indexConfigurations: ins.indexConfigurations,
                vendors: ins.vendors,
                configuration: config
                    ? {
                          buildIssues: config.buildIssues,
                          parameters: config.parameters
                      }
                    : undefined,
                lastLoadedAt: ins.lastLoadedAt
            };
        }

        return c.json({
            groups: groupsOut,
            insertables: insertablesOut
        } satisfies LibraryBuildStatus);
    }
);

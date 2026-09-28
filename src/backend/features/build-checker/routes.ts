import { asc, eq } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { getDb } from "../../db/client";
import { toElementPath } from "../../lib/onshape/path";
import { requireEditorMiddleware } from "../auth/guards";
import { groups, insertables, configurations } from "../../db/schema";
import type {
    LibraryBuildStatus,
    GroupBuildStatus,
    InsertableBuildStatus
} from "./contract";

export const buildStatusRoutes = getApp();

/** GET /api/build-status/library/:libraryId?v=:cacheVersion */
buildStatusRoutes.get(
    "/build-status" + libraryRoute(),
    requireEditorMiddleware,
    // Private: only editors may see it.
    cacheMiddleware(CachePolicy.PRIVATE_CACHE),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);

        const [allGroups, allInsertables] = await Promise.all([
            db
                .select({
                    id: groups.id,
                    buildIssues: groups.buildIssues,
                    sortAlphabetically: groups.sortAlphabetically,
                    sortOrder: groups.sortOrder,
                    versionCreatedAt: groups.versionCreatedAt
                })
                .from(groups)
                .where(eq(groups.libraryId, libraryId))
                .orderBy(asc(groups.sortOrder))
                .all(),
            db
                .select({
                    id: insertables.id,
                    groupId: insertables.groupId,
                    buildIssues: insertables.buildIssues,
                    documentId: insertables.documentId,
                    versionId: insertables.versionId,
                    elementId: insertables.elementId,
                    elementType: insertables.elementType,
                    isVisible: insertables.isVisible,
                    supportsFasten: insertables.supportsFasten,
                    indexConfigurations: insertables.indexConfigurations,
                    excludedParameterIds: insertables.excludedParameterIds,
                    vendors: insertables.vendors,
                    sortOrder: insertables.sortOrder,
                    versionCreatedAt: insertables.versionCreatedAt
                })
                .from(insertables)
                .where(eq(insertables.libraryId, libraryId))
                .orderBy(asc(insertables.sortOrder))
                .all()
        ]);

        // Joined rather than filtered by id: D1 binds at most 100 parameters.
        const allConfigurations = await db
            .select({
                insertableId: configurations.insertableId,
                parameters: configurations.parameters
            })
            .from(configurations)
            .innerJoin(
                insertables,
                eq(configurations.insertableId, insertables.id)
            )
            .where(eq(insertables.libraryId, libraryId))
            .all();

        const configMap = new Map(
            allConfigurations.map(({ insertableId, ...status }) => [
                insertableId,
                status
            ])
        );

        const groupsOut: Record<string, GroupBuildStatus> = {};
        for (const group of allGroups) {
            const groupInsertables = allInsertables
                .filter((ins) => ins.groupId === group.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
            groupsOut[group.id] = {
                buildIssues: group.buildIssues,
                sortAlphabetically: group.sortAlphabetically,
                insertableOrder: groupInsertables.map((ins) => ins.id),
                versionCreatedAt: group.versionCreatedAt?.getTime()
            };
        }

        const insertablesOut: Record<string, InsertableBuildStatus> = {};
        for (const ins of allInsertables) {
            insertablesOut[ins.id] = {
                buildIssues: ins.buildIssues,
                elementPath: toElementPath(ins),
                elementType: ins.elementType,
                isVisible: ins.isVisible,
                supportsFasten: ins.supportsFasten,
                indexConfigurations: ins.indexConfigurations,
                excludedParameterIds: ins.excludedParameterIds,
                vendors: ins.vendors,
                configuration: configMap.get(ins.id),
                versionCreatedAt: ins.versionCreatedAt?.getTime()
            };
        }

        return c.json({
            groups: groupsOut,
            insertables: insertablesOut
        } satisfies LibraryBuildStatus);
    }
);

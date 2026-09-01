import { asc, eq, inArray } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getLibraryParam, libraryRoute } from "../../lib/route-params";
import { getDb } from "../../db/client";
import { requireEditorMiddleware } from "../auth/guards";
import { group, insertables, configurations } from "../../db/schema";
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
    // The same for every editor, but only for an editor: a shared cache would
    // hand it to whoever asked for the url next.
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
            insertablesOut[ins.id] = {
                buildIssues: ins.buildIssues,
                elementType: ins.elementType,
                isVisible: ins.isVisible,
                supportsFasten: ins.supportsFasten,
                indexConfigurations: ins.indexConfigurations,
                vendors: ins.vendors,
                configuration: configMap.get(ins.id),
                lastLoadedAt: ins.lastLoadedAt
            };
        }

        return c.json({
            groups: groupsOut,
            insertables: insertablesOut
        } satisfies LibraryBuildStatus);
    }
);

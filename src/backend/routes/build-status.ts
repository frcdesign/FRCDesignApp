import { asc, eq, inArray } from "drizzle-orm";
import { getApp, getLibraryParam, libraryRoute } from "../app";
import { getDb } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import { group, insertables, configurations } from "../../shared/schema";
import {
    type LibraryBuildStatus,
    type GroupBuildStatus,
    type InsertableBuildStatus
} from "../../shared/api-models";

export const buildStatusRoutes = getApp();

/** GET /api/build-status/library/:libraryId */
buildStatusRoutes.get(
    "/build-status" + libraryRoute(),
    requireEditorMiddleware,
    async (c) => {
        const libraryId = getLibraryParam(c);
        const db = getDb(c.env.DB);

        const [allGroups, allInsertables] = await Promise.all([
            db
                .select({
                    id: group.id,
                    buildIssues: group.buildIssues,
                    sortAlphabetically: group.sortAlphabetically,
                    sortOrder: group.sortOrder
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
                    isVisible: insertables.isVisible,
                    isOpenComposite: insertables.isOpenComposite,
                    supportsFasten: insertables.supportsFasten,
                    vendors: insertables.vendors,
                    sortOrder: insertables.sortOrder
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
                insertableOrder: groupInsertables.map((ins) => ins.id)
            };
        }

        const insertablesOut: Record<string, InsertableBuildStatus> = {};
        for (const ins of allInsertables) {
            const config = configMap.get(ins.id);
            insertablesOut[ins.id] = {
                buildIssues: ins.buildIssues,
                isVisible: ins.isVisible,
                isOpenComposite: ins.isOpenComposite,
                supportsFasten: ins.supportsFasten,
                vendors: ins.vendors,
                configuration: config
                    ? {
                          buildIssues: config.buildIssues,
                          parameters: config.parameters
                      }
                    : undefined
            };
        }

        return c.json({
            groups: groupsOut,
            insertables: insertablesOut
        } satisfies LibraryBuildStatus);
    }
);

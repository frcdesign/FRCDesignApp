import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { getApp, getInsertableParam, insertableRoute } from "../app";
import { getDb, type Db } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import { insertables, configurations } from "../../shared/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import { type ElementPath } from "../../shared/onshape-path";
import {
    type ParameterValues,
    type ConfigurationParameter
} from "../../shared/configuration-models";
import {
    NO_PART_NUMBERS,
    PART_NUMBER_ISSUE_TYPES,
    parsePartNumbers,
    type PartNumberResult
} from "../parse/parse-part-number";
import { type OnshapeApi } from "../onshape-api/onshape-api";
import { ElementType } from "../../shared/types";
import { DerivedFeature } from "../onshape-api/objects/derive-feature";
import { addPartStudioFeature } from "../onshape-api/endpoints/part-studios";
import {
    addElementToAssembly,
    addAssemblyFeature
} from "../onshape-api/endpoints/assemblies";
import {
    PartType,
    type OnshapeElementType
} from "../onshape-api/endpoints/documents";
import { encodeConfiguration } from "../onshape-api/endpoints/configurations";
import { FastenMateBuilder } from "../onshape-api/objects/assembly-features";
import { getFastenQuery, parseFastenInfo } from "../parse/insert-and-fasten";
import { addBuildIssue, clearBuildIssue } from "../../shared/build-issues";

export const insertableRoutes = getApp();

/** POST /api/toggle-open-composite/insertable/:insertableId */
insertableRoutes.post(
    "/toggle-open-composite" + insertableRoute(),
    requireEditorMiddleware,
    async (c) => {
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{ isOpenComposite: boolean }>();

        const db = getDb(c.env.DB);
        const row = await db
            .select({ libraryId: insertables.libraryId })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row)
            throw new HTTPException(404, { message: "Insertable not found" });

        await db
            .update(insertables)
            .set({ isOpenComposite: body.isOpenComposite })
            .where(eq(insertables.id, insertableId));

        await bumpLibraryVersion(db, row.libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/toggle-insert-and-fasten/insertable/:insertableId */
insertableRoutes.post(
    "/toggle-insert-and-fasten" + insertableRoute(),
    requireEditorMiddleware,
    async (c) => {
        const db = getDb(c.env.DB);

        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{ supportsFasten: boolean }>();

        const insertableRow = await db
            .select({ libraryId: insertables.libraryId })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!insertableRow)
            throw new HTTPException(404, { message: "Insertable not found" });

        let fastenInfo = null;
        if (body.supportsFasten) {
            const onshapeApi = await c.var.getOnshapeApi();
            const elementPath = await getInsertableElementPath(
                db,
                insertableId
            );
            const insertable = await db
                .select({
                    elementType: insertables.elementType
                })
                .from(insertables)
                .where(eq(insertables.id, insertableId))
                .get();

            if (!insertable) {
                throw new HTTPException(404, {
                    message: "Insertable not found"
                });
            }

            fastenInfo = await parseFastenInfo(
                onshapeApi,
                elementPath,
                insertable.elementType
            );
        }

        await db
            .update(insertables)
            .set({ supportsFasten: body.supportsFasten, fastenInfo })
            .where(eq(insertables.id, insertableId));

        await bumpLibraryVersion(db, insertableRow.libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/toggle-part-number-search/insertable/:insertableId */
insertableRoutes.post(
    "/toggle-part-number-search" + insertableRoute(),
    requireEditorMiddleware,
    async (c) => {
        const db = getDb(c.env.DB);
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{ searchPartNumbers: boolean }>();

        const row = await db
            .select({
                libraryId: insertables.libraryId,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                elementType: insertables.elementType,
                buildIssues: insertables.buildIssues
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row)
            throw new HTTPException(404, { message: "Insertable not found" });

        // Index before committing anything: if this throws, the flag stays off
        // rather than being enabled with nothing indexed behind it. The error
        // reaches the client via the app's onError handler.
        const indexed = body.searchPartNumbers
            ? await indexPartNumbers(await c.var.getOnshapeApi(), db, {
                  insertableId,
                  ...row
              })
            : NO_PART_NUMBERS;

        await db.batch([
            db
                .update(insertables)
                .set({
                    searchPartNumbers: body.searchPartNumbers,
                    defaultPartNumber: indexed.defaultPartNumber,
                    // Clear first, so an issue the reindex resolved (or that
                    // disabling makes moot) doesn't stick around.
                    buildIssues: addBuildIssue(
                        clearBuildIssue(
                            row.buildIssues,
                            ...PART_NUMBER_ISSUE_TYPES
                        ),
                        ...indexed.buildIssues
                    )
                })
                .where(eq(insertables.id, insertableId)),
            // No-op when the insertable has no configuration row.
            db
                .update(configurations)
                .set({ partNumbers: indexed.partNumbers })
                .where(eq(configurations.id, insertableId))
        ]);

        await bumpLibraryVersion(db, row.libraryId);
        // Part numbers live in the search index, so rebuild it now.
        await rebuildSearchDb(db, row.libraryId);
        return c.json({ success: true });
    }
);

/**
 * Indexes an insertable's part numbers for the toggle route, reading the
 * parameters it needs. Runs in a request, so it uses the unbatched
 * {@link parsePartNumbers} rather than the workflow's stepped loader.
 */
async function indexPartNumbers(
    client: OnshapeApi,
    db: Db,
    insertable: {
        insertableId: string;
        documentId: string;
        versionId: string;
        elementId: string;
        elementType: ElementType;
    }
): Promise<PartNumberResult> {
    const sourcePath: ElementPath = {
        documentId: insertable.documentId,
        instanceId: insertable.versionId,
        instanceType: "v",
        elementId: insertable.elementId
    };
    const configRow = await db
        .select({ parameters: configurations.parameters })
        .from(configurations)
        .where(eq(configurations.id, insertable.insertableId))
        .get();

    return parsePartNumbers(
        client,
        sourcePath,
        insertable.elementType,
        configRow?.parameters ?? []
    );
}

/** POST /api/add-to-part-studio/insertable/:insertableId/d/:documentId/:instanceType/:instanceId/e/:elementId */
insertableRoutes.post(
    "/add-to-part-studio" +
        insertableRoute() +
        "/d/:documentId/:instanceType/:instanceId/e/:elementId",
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{
            configuration: ParameterValues | undefined;
            useMateConnector: boolean;
            isFavorite: boolean;
            isQuickInsert: boolean;
        }>();

        // Target part studio — from URL
        const targetPath: ElementPath = {
            documentId: c.req.param("documentId")!,
            instanceId: c.req.param("instanceId")!,
            instanceType: c.req.param("instanceType") as "w" | "v" | "m",
            elementId: c.req.param("elementId")!
        };

        const db = getDb(c.env.DB);
        const sourcePath = await getInsertableElementPath(db, insertableId);

        const insertable = await db
            .select({
                name: insertables.name,
                microversionId: insertables.microversionId
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();

        if (!insertable) {
            throw new HTTPException(404, {
                message: "Insertable not found"
            });
        }

        // Look up parsed configuration parameters from D1 if configuration is provided
        let parameters: ConfigurationParameter[] | undefined;
        if (body.configuration) {
            const configRow = await db
                .select({ parameters: configurations.parameters })
                .from(configurations)
                .where(eq(configurations.id, insertableId))
                .get();
            parameters = configRow?.parameters;
        }

        const feature = new DerivedFeature(
            insertable.name,
            sourcePath,
            insertable.microversionId,
            body.useMateConnector,
            body.configuration,
            parameters
        );

        const result = await addPartStudioFeature(
            onshapeApi,
            targetPath,
            feature.getFeature()
        );
        return c.json({ featureId: result.feature?.featureId });
    }
);

/** POST /api/add-to-assembly/insertable/:insertableId/d/:documentId/:instanceType/:instanceId/e/:elementId */
insertableRoutes.post(
    "/add-to-assembly" +
        insertableRoute() +
        "/d/:documentId/:instanceType/:instanceId/e/:elementId",
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{
            configuration: ParameterValues | undefined;
            fasten: boolean;
            isFavorite: boolean;
            isQuickInsert: boolean;
        }>();

        // Target assembly — from URL
        const targetPath: ElementPath = {
            documentId: c.req.param("documentId")!,
            instanceId: c.req.param("instanceId")!,
            instanceType: c.req.param("instanceType") as "w" | "v" | "m",
            elementId: c.req.param("elementId")!
        };

        const db = getDb(c.env.DB);

        // Single select for all insertable fields needed
        const row = await db
            .select({
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                name: insertables.name,
                elementType: insertables.elementType,
                isOpenComposite: insertables.isOpenComposite,
                fastenInfo: insertables.fastenInfo
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();

        if (!row) {
            throw new HTTPException(404, { message: "Insertable not found" });
        }

        const sourcePath: ElementPath = {
            documentId: row.documentId,
            instanceId: row.versionId,
            instanceType: "v",
            elementId: row.elementId
        };

        const partTypes = row.isOpenComposite
            ? [PartType.COMPOSITE_PARTS]
            : [PartType.PARTS, PartType.COMPOSITE_PARTS];

        // Apply default configuration when element is configurable and none was provided
        let configuration = body.configuration;
        if (configuration === undefined) {
            const configRow = await db
                .select({ parameters: configurations.parameters })
                .from(configurations)
                .where(eq(configurations.id, insertableId))
                .get();
            if (configRow && configRow.parameters.length > 0) {
                configuration = Object.fromEntries(
                    configRow.parameters.map((p) => [p.id, p.default])
                );
            }
        }

        const encodedConfiguration = configuration
            ? encodeConfiguration(configuration)
            : undefined;

        const result = await addElementToAssembly(
            onshapeApi,
            targetPath,
            sourcePath,
            row.elementType as unknown as OnshapeElementType,
            {
                configuration: encodedConfiguration,
                partTypes
            }
        );

        if (!body.fasten) {
            return c.json({ featureId: null });
        }

        const fastenInfo = row.fastenInfo;
        if (!fastenInfo) {
            throw new HTTPException(400, {
                message: `${row.name} does not support insert and fasten.`
            });
        }

        const instancePath: string[] =
            result.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];

        const builder = new FastenMateBuilder(row.name);
        builder.addQuery(
            getFastenQuery(row.elementType, instancePath, fastenInfo)
        );

        const fastenResult = await addAssemblyFeature(
            onshapeApi,
            targetPath,
            builder.build()
        );
        return c.json({ featureId: fastenResult.feature.featureId });
    }
);
/**
 * Returns the ElementPath for an insertable looked up by its ID.
 * Throws 404 if the insertable does not exist.
 * Insertable elements are always version-pinned (instanceType "v").
 */

export async function getInsertableElementPath(
    db: Db,
    insertableId: string
): Promise<ElementPath> {
    const row = await db
        .select({
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId
        })
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();

    if (!row) {
        throw new HTTPException(404, { message: "Insertable not found" });
    }

    return {
        documentId: row.documentId,
        instanceId: row.versionId,
        instanceType: "v",
        elementId: row.elementId
    };
}

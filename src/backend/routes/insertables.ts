import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { HttpStatus } from "http-status-ts";
import z from "zod";
import { getApp, getInsertableParam, insertableRoute } from "../app";
import { getDb, type Db } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import { requireSignInMiddleware } from "../sign-in-utils";
import { insertables, configurations } from "../../shared/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../library-data";
import { type ElementPath, INSTANCE_TYPES } from "../../shared/onshape-path";
import { type ConfigurationParameter } from "../../shared/configuration-models";
import {
    INDEXING_ISSUE_TYPES,
    NO_RECORDS,
    decideIndexing,
    parseConfigurationRecords,
    type ConfigurationRecordsResult
} from "../parse/parse-configuration-records";
import { type OnshapeApi } from "../onshape-api/onshape-api";
import { ElementType } from "../../shared/types";
import { parseVendors } from "../parse/parse-vendors";
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
            throw new HTTPException(HttpStatus.NOT_FOUND, {
                message: "Insertable not found"
            });

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
                throw new HTTPException(HttpStatus.NOT_FOUND, {
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
        const body = await c.req.json<{ forceIndex: boolean }>();

        const row = await db
            .select({
                libraryId: insertables.libraryId,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                elementType: insertables.elementType,
                name: insertables.name,
                isOpenComposite: insertables.isOpenComposite,
                buildIssues: insertables.buildIssues
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row)
            throw new HTTPException(HttpStatus.NOT_FOUND, {
                message: "Insertable not found"
            });

        const parameters =
            (
                await db
                    .select({ parameters: configurations.parameters })
                    .from(configurations)
                    .where(eq(configurations.id, insertableId))
                    .get()
            )?.parameters ?? [];
        const vendors = parseVendors(row.name, parameters);
        const indexing = decideIndexing(vendors, parameters, body.forceIndex);

        // Index before committing anything: if this throws, nothing is written.
        // The error reaches the client via the app's onError handler.
        const indexed = indexing.shouldIndex
            ? await indexRecords(await c.var.getOnshapeApi(), {
                  documentId: row.documentId,
                  versionId: row.versionId,
                  elementId: row.elementId,
                  elementType: row.elementType,
                  isOpenComposite: row.isOpenComposite,
                  parameters
              })
            : NO_RECORDS;

        // Clear first, so an issue the reindex resolved (or that disabling makes
        // moot) doesn't stick around.
        const buildIssues = addBuildIssue(
            clearBuildIssue(row.buildIssues, ...INDEXING_ISSUE_TYPES),
            ...indexed.buildIssues,
            ...indexing.buildIssues
        );

        // Keep a configurations row while there's parameters or records to hold;
        // a non-configurable insertable that stops indexing loses its row.
        const configWrite =
            parameters.length > 0 || indexed.records.length > 0
                ? db
                      .insert(configurations)
                      .values({
                          id: insertableId,
                          parameters,
                          records: indexed.records
                      })
                      .onConflictDoUpdate({
                          target: configurations.id,
                          set: { records: indexed.records }
                      })
                : db
                      .delete(configurations)
                      .where(eq(configurations.id, insertableId));

        await db.batch([
            db
                .update(insertables)
                .set({ forceIndex: body.forceIndex, buildIssues })
                .where(eq(insertables.id, insertableId)),
            configWrite
        ]);

        // Records feed the search index; rebuild before the bump makes the
        // /search-db url immutable, or a stale index gets pinned for a year.
        await rebuildSearchDb(c.env.BLOB, db, row.libraryId);
        await bumpLibraryVersion(db, row.libraryId);
        return c.json({ success: true });
    }
);

/**
 * Indexes an insertable's configuration records for the toggle route. Runs in a
 * request, so it uses the unbatched {@link parseConfigurationRecords} rather than
 * the workflow's stepped loader.
 */
function indexRecords(
    client: OnshapeApi,
    insertable: {
        documentId: string;
        versionId: string;
        elementId: string;
        elementType: ElementType;
        isOpenComposite: boolean;
        parameters: ConfigurationParameter[];
    }
): Promise<ConfigurationRecordsResult> {
    const sourcePath: ElementPath = {
        documentId: insertable.documentId,
        instanceId: insertable.versionId,
        instanceType: "v",
        elementId: insertable.elementId
    };
    return parseConfigurationRecords(
        client,
        sourcePath,
        insertable.elementType,
        insertable.parameters,
        insertable.isOpenComposite
    );
}

/**
 * The tab being inserted into. It rides in the body rather than the URL so the
 * whole path — including which kind of instance the id refers to — arrives as
 * one object, and a half-built one is rejected here rather than reaching
 * Onshape as a nonsense URL.
 */
const targetPathSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    elementId: z.string().min(1)
});

const configurationSchema = z.record(z.string(), z.string()).optional();

const insertBodySchema = z.object({
    targetPath: targetPathSchema,
    configuration: configurationSchema,
    isFavorite: z.boolean().default(false),
    isQuickInsert: z.boolean().default(false)
});

const addToPartStudioBody = insertBodySchema.extend({
    useMateConnector: z.boolean().default(false)
});

const addToAssemblyBody = insertBodySchema.extend({
    fasten: z.boolean().default(false)
});

/** POST /api/add-to-part-studio/insertable/:insertableId */
insertableRoutes.post(
    "/add-to-part-studio" + insertableRoute(),
    requireSignInMiddleware,
    zValidator("json", addToPartStudioBody),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const insertableId = getInsertableParam(c);
        const body = c.req.valid("json");
        const { targetPath } = body;

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
            throw new HTTPException(HttpStatus.NOT_FOUND, {
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

/** POST /api/add-to-assembly/insertable/:insertableId */
insertableRoutes.post(
    "/add-to-assembly" + insertableRoute(),
    requireSignInMiddleware,
    zValidator("json", addToAssemblyBody),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const insertableId = getInsertableParam(c);
        const body = c.req.valid("json");
        const { targetPath } = body;

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
            throw new HTTPException(HttpStatus.NOT_FOUND, {
                message: "Insertable not found"
            });
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
            throw new HTTPException(HttpStatus.BAD_REQUEST, {
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
        throw new HTTPException(HttpStatus.NOT_FOUND, {
            message: "Insertable not found"
        });
    }

    return {
        documentId: row.documentId,
        instanceId: row.versionId,
        instanceType: "v",
        elementId: row.elementId
    };
}

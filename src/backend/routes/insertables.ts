import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { getApp, getInsertableParam, insertableRoute } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { requireAdminMiddleware } from "../access-level-utils";
import { insertables, configurations } from "../../shared/schema";
import { type ElementPath } from "../../shared/path";
import {
    type Configuration,
    type ParameterObj
} from "../../shared/configuration-models";
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
import { getInsertableElementPath } from "../db-helpers";
import { encodeConfiguration } from "../onshape-api/endpoints/configurations";
import { FastenMateBuilder } from "../onshape-api/objects/assembly-features";
import { getFastenQuery, parseFastenInfo } from "../parse/insert-and-fasten";

export const insertableRoutes = getApp();

/** POST /api/toggle-open-composite/insertable/:insertableId */
insertableRoutes
    .use(requireAdminMiddleware)
    .post("/toggle-open-composite" + insertableRoute(), async (c) => {
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{ isOpenComposite: boolean }>();

        const db = getDb(c.env.DB);
        await db
            .update(insertables)
            .set({ isOpenComposite: body.isOpenComposite })
            .where(eq(insertables.id, insertableId));

        return c.json({ success: true });
    });

/** POST /api/toggle-insert-and-fasten/insertable/:insertableId */
insertableRoutes
    .use(requireAdminMiddleware)
    .post("/toggle-insert-and-fasten" + insertableRoute(), async (c) => {
        const db = getDb(c.env.DB);

        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{ supportsFasten: boolean }>();

        let fastenInfo = null;
        if (body.supportsFasten) {
            const onshapeApi = await getOnshapeApi(c);
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

        return c.json({ success: true });
    });

/** POST /api/add-to-part-studio/insertable/:insertableId/d/:documentId/:instanceType/:instanceId/e/:elementId */
insertableRoutes.post(
    "/add-to-part-studio" +
        insertableRoute() +
        "/d/:documentId/:instanceType/:instanceId/e/:elementId",
    async (c) => {
        const onshapeApi = await getOnshapeApi(c);
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{
            configuration: Configuration | undefined;
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
        let parameters: ParameterObj[] | undefined;
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
        const onshapeApi = await getOnshapeApi(c);
        const insertableId = getInsertableParam(c);
        const body = await c.req.json<{
            configuration: Configuration | undefined;
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
                instanceId: insertables.instanceId,
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
            instanceId: row.instanceId,
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
                partTypes,
                useTransform: body.fasten
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
            result?.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];

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

import { eq } from "drizzle-orm";
import { handledError, internalError } from "../../../lib/api-error";
import { validate } from "../../../lib/validate";
import { HttpStatus } from "http-status-ts";
import z from "zod";
import { getApp } from "../../../lib/context";
import { getInsertableParam, insertableRoute } from "../../../lib/route-params";
import { getDb, type Db } from "../../../db/client";
import {
    requireEditorMiddleware,
    requireSignInMiddleware
} from "../../auth/guards";
import { insertables, configurations } from "../../../db/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../db";
import { type InsertOut } from "../contract";
import { toElementPath, INSTANCE_TYPES } from "../../../lib/onshape/path";
import {
    type ConfigurationParameter,
    type Selection
} from "../../configurations/contract";
import {
    INDEXING_ISSUE_TYPES,
    NO_RECORDS,
    decideIndexing,
    parseConfigurationRecords
} from "../../load/parse-configuration-records";
import { ElementType } from "../../../lib/onshape/element-type";
import { InsertSource } from "../../analytics/events";
import { trackInBackground, trackInsert } from "../../analytics/tracking";
import { DerivedFeature } from "../../../lib/onshape/objects/derive-feature";
import { addPartStudioFeature } from "../../../lib/onshape/endpoints/part-studios";
import {
    addElementToAssembly,
    addAssemblyFeature
} from "../../../lib/onshape/endpoints/assemblies";
import { PartType } from "../../../lib/onshape/endpoints/documents";
import { toSelection } from "../../configurations/selection";
import { encodeConfiguration } from "../../configurations/utils";
import { fastenMate } from "../../../lib/onshape/objects/assembly-features";
import { parseFastenInfo } from "../../load/parse-fasten";
import { getFastenQuery } from "./fasten-query";
import { addBuildIssue, clearBuildIssue } from "../../build-checker/issues";

export const insertableRoutes = getApp();

/** POST /api/toggle-insert-and-fasten/insertable/:insertableId */
const setFastenBody = z.object({ supportsFasten: z.boolean() });

const indexConfigurationsBody = z.object({ indexConfigurations: z.boolean() });

insertableRoutes.post(
    "/toggle-insert-and-fasten" + insertableRoute(),
    requireEditorMiddleware,
    validate("json", setFastenBody),
    async (c) => {
        const db = getDb(c.env.DB);

        const insertableId = getInsertableParam(c);
        const { supportsFasten } = c.req.valid("json");

        const row = await db
            .select({
                libraryId: insertables.libraryId,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                elementType: insertables.elementType
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row)
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);

        let fastenInfo = null;
        if (supportsFasten) {
            fastenInfo = await parseFastenInfo(
                await c.var.getOnshapeApi(),
                toElementPath(row),
                row.elementType
            );
        }

        await db
            .update(insertables)
            .set({ supportsFasten, fastenInfo })
            .where(eq(insertables.id, insertableId));

        await bumpLibraryVersion(db, row.libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/index-configurations/insertable/:insertableId */
insertableRoutes.post(
    "/index-configurations" + insertableRoute(),
    requireEditorMiddleware,
    validate("json", indexConfigurationsBody),
    async (c) => {
        const db = getDb(c.env.DB);
        const insertableId = getInsertableParam(c);
        const body = c.req.valid("json");

        const row = await db
            .select({
                libraryId: insertables.libraryId,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                elementType: insertables.elementType,
                vendors: insertables.vendors,
                isOpenComposite: insertables.isOpenComposite,
                buildIssues: insertables.buildIssues
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row)
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);

        const parameters =
            (
                await db
                    .select({ parameters: configurations.parameters })
                    .from(configurations)
                    .where(eq(configurations.insertableId, insertableId))
                    .get()
            )?.parameters ?? [];
        const indexing = decideIndexing(
            row.elementType,
            parameters,
            body.indexConfigurations
        );

        // Index before committing anything: if this throws, nothing is written.
        // The error reaches the client via the app's onError handler.
        const indexed = indexing.shouldIndex
            ? await parseConfigurationRecords(
                  await c.var.getOnshapeApi(),
                  {
                      elementPath: toElementPath(row),
                      elementType: row.elementType,
                      isOpenComposite: row.isOpenComposite
                  },
                  parameters,
                  indexing.configurations
              )
            : NO_RECORDS;

        // Clear first, so an issue the reindex resolved (or that disabling makes
        // moot) doesn't stick around.
        const buildIssues = addBuildIssue(
            clearBuildIssue(row.buildIssues, ...INDEXING_ISSUE_TYPES),
            ...indexed.buildIssues,
            ...indexing.buildIssues
        );

        // A configurations row exists exactly when the insertable is configurable.
        const configWrite =
            parameters.length > 0
                ? db
                      .insert(configurations)
                      .values({
                          insertableId,
                          parameters,
                          records: indexed.records
                      })
                      .onConflictDoUpdate({
                          target: configurations.insertableId,
                          set: { records: indexed.records }
                      })
                : db
                      .delete(configurations)
                      .where(eq(configurations.insertableId, insertableId));

        await db.batch([
            db
                .update(insertables)
                .set({
                    indexConfigurations: body.indexConfigurations,
                    partMetadata: indexed.partMetadata,
                    buildIssues
                })
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
 * The tab being inserted into, in the body so the whole path arrives as one
 * object. A half-built one is rejected here, not as a nonsense Onshape URL.
 */
const targetPathSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    elementId: z.string().min(1)
});

const selectionSchema = z.record(z.string(), z.string()).optional();

/**
 * What an insert applies, made whole against the insertable's parameters. Every
 * request crosses here, so nothing past it holds a partial or as-typed map.
 */
async function readSelection(
    db: Db,
    insertableId: string,
    requested: Selection | undefined
): Promise<{
    selection: Selection | undefined;
    parameters: ConfigurationParameter[];
}> {
    const row = await db
        .select({ parameters: configurations.parameters })
        .from(configurations)
        .where(eq(configurations.insertableId, insertableId))
        .get();

    const parameters = row?.parameters ?? [];
    return {
        selection:
            parameters.length === 0
                ? undefined
                : toSelection(requested ?? {}, parameters),
        parameters
    };
}

const insertBody = z.object({
    targetPath: targetPathSchema,
    selection: selectionSchema,
    isFavorite: z.boolean().default(false),
    isQuickInsert: z.boolean().default(false),
    // Where the insert began, which `isFavorite` does not answer. Defaulted so
    // an older client cannot drop the whole tracking batch on a NOT NULL.
    source: z.enum(InsertSource).default(InsertSource.BROWSE)
});

const addToPartStudioBody = insertBody.extend({
    useMateConnector: z.boolean().default(false)
});

const addToAssemblyBody = insertBody.extend({
    fasten: z.boolean().default(false)
});

/** POST /api/add-to-part-studio/insertable/:insertableId */
insertableRoutes.post(
    "/add-to-part-studio" + insertableRoute(),
    requireSignInMiddleware,
    validate("json", addToPartStudioBody),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const insertableId = getInsertableParam(c);
        const body = c.req.valid("json");
        const { targetPath } = body;

        const db = getDb(c.env.DB);
        const row = await db
            .select({
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                name: insertables.name,
                microversionId: insertables.microversionId,
                libraryId: insertables.libraryId
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();

        if (!row) {
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);
        }

        const sourcePath = toElementPath(row);

        const { selection, parameters } = await readSelection(
            db,
            insertableId,
            body.selection
        );

        const feature = new DerivedFeature(
            row.name,
            sourcePath,
            row.microversionId,
            body.useMateConnector,
            selection,
            parameters
        );

        const result = await addPartStudioFeature(
            onshapeApi,
            targetPath,
            feature.getFeature()
        );

        await trackInBackground(c, async () =>
            trackInsert(c, {
                libraryId: row.libraryId,
                userId: await c.var.getUserId(),
                path: sourcePath,
                insertableId,
                targetElementType: ElementType.PART_STUDIO,
                selection,
                parameters,
                isFavorite: body.isFavorite,
                isQuickInsert: body.isQuickInsert,
                source: body.source,
                // Insert-and-fasten is only offered for assembly targets.
                fasten: false
            })
        );

        return c.json({
            featureId: result.feature?.featureId ?? null
        } satisfies InsertOut);
    }
);

/** POST /api/add-to-assembly/insertable/:insertableId */
insertableRoutes.post(
    "/add-to-assembly" + insertableRoute(),
    requireSignInMiddleware,
    validate("json", addToAssemblyBody),
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
                libraryId: insertables.libraryId,
                name: insertables.name,
                elementType: insertables.elementType,
                isOpenComposite: insertables.isOpenComposite,
                fastenInfo: insertables.fastenInfo
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();

        if (!row) {
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);
        }

        const sourcePath = toElementPath(row);

        const partTypes = row.isOpenComposite
            ? [PartType.COMPOSITE_PARTS]
            : [PartType.PARTS, PartType.COMPOSITE_PARTS];

        const { selection, parameters } = await readSelection(
            db,
            insertableId,
            body.selection
        );

        const encodedConfiguration = selection
            ? encodeConfiguration(selection)
            : undefined;

        const result = await addElementToAssembly(
            onshapeApi,
            targetPath,
            sourcePath,
            row.elementType,
            {
                configuration: encodedConfiguration,
                partTypes
            }
        );

        // The insert has landed, and every path below records it exactly once — so a
        // fasten that never happened leaves none unrecorded, and `fasten` says what was.
        const track = (fasten: boolean) =>
            trackInBackground(c, async () =>
                trackInsert(c, {
                    libraryId: row.libraryId,
                    userId: await c.var.getUserId(),
                    path: sourcePath,
                    insertableId,
                    targetElementType: ElementType.ASSEMBLY,
                    selection,
                    parameters,
                    isFavorite: body.isFavorite,
                    isQuickInsert: body.isQuickInsert,
                    source: body.source,
                    fasten
                })
            );

        if (!body.fasten) {
            await track(false);
            return c.json({ featureId: null } satisfies InsertOut);
        }

        const fastenInfo = row.fastenInfo;
        if (!fastenInfo) {
            await track(false);
            throw handledError(
                `${row.name} does not support insert and fasten.`,
                HttpStatus.BAD_REQUEST
            );
        }

        const instancePath: string[] =
            result.insertInstanceResponses?.[0]?.occurrences?.[0]?.path ?? [];

        const mate = fastenMate(row.name, [
            getFastenQuery(row.elementType, instancePath, fastenInfo)
        ]);

        try {
            const fastenResult = await addAssemblyFeature(
                onshapeApi,
                targetPath,
                mate
            );
            await track(true);
            return c.json({
                featureId: fastenResult.feature.featureId
            } satisfies InsertOut);
        } catch (error) {
            // Only the mate failed; the insert is still in the assembly.
            await track(false);
            throw error;
        }
    }
);

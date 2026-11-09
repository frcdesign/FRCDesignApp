import { and, eq } from "drizzle-orm";
import { handledError, internalError } from "../../../lib/api-error";
import { validate } from "../../../lib/validate";
import { HttpStatus } from "http-status-ts";
import z from "zod";
import { type AppContext, getApp } from "../../../lib/context";
import type { BatchItem } from "drizzle-orm/batch";
import {
    getInsertableParam,
    getLibraryParam,
    insertableRoute,
    libraryRoute
} from "../../../lib/route-params";
import { getDb } from "../../../db/client";
import {
    requireEditorMiddleware,
    requireSignInMiddleware
} from "../../auth/guards";
import { insertables, configurations } from "../../../db/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../db";
import { type InsertOut } from "../contract";
import type { LibraryId } from "../library-id";
import { toElementPath, INSTANCE_TYPES } from "../../../lib/onshape/path";
import {
    INDEXING_ISSUE_TYPES,
    NO_RECORDS,
    decideIndexing,
    parseConfigurationRecords
} from "../../load/parse-configuration-records";
import { ElementType } from "../../../lib/onshape/element-type";
import type { IndexingSettings } from "../../build-checker/contract";
import { UseSource } from "../../analytics/usage";
import { trackInsert } from "../../analytics/tracking";
import { recordRecentInsert } from "../../recents/store";
import { DerivedFeature } from "../../../lib/onshape/objects/derive-feature";
import { addPartStudioFeature } from "../../../lib/onshape/endpoints/part-studios";
import {
    addElementToAssembly,
    addAssemblyFeature
} from "../../../lib/onshape/endpoints/assemblies";
import { PartType } from "../../../lib/onshape/endpoints/documents";
import { retryOnServerError } from "../../../lib/onshape/retry";
import { onshapeOverrides } from "../../configurations/selection";
import { readSelection, selectionSchema } from "./read-selection";
import { encodeConfiguration } from "../../configurations/utils";
import { fastenMate } from "../../../lib/onshape/objects/assembly-features";
import {
    decideFasten,
    FASTEN_ISSUE_TYPES,
    findMateConnector
} from "../../load/parse-fasten";
import { getFastenQuery } from "./fasten-query";
import { getInsertLocationTransform } from "../../insert-location/parse";
import { replaceBuildIssues } from "../../build-checker/issues";

export const insertableRoutes = getApp();

/** An editor's access is to the path's library, so the insertable must be in it. */
function inLibrary(libraryId: LibraryId, insertableId: string) {
    return and(
        eq(insertables.id, insertableId),
        eq(insertables.libraryId, libraryId)
    );
}

const setFastenBody = z.object({ supportsFasten: z.boolean() });

/** Both settings, so an admin's edits land in one reindex. */
const indexingBody = z.object({
    indexConfigurations: z.boolean(),
    excludedParameterIds: z.array(z.string())
}) satisfies z.ZodType<IndexingSettings>;

/** POST /api/toggle-insert-and-fasten/library/:libraryId/insertable/:insertableId */
insertableRoutes.post(
    "/toggle-insert-and-fasten" + libraryRoute() + insertableRoute(),
    requireEditorMiddleware,
    validate("json", setFastenBody),
    async (c) => {
        const db = getDb(c.env.DB);

        const libraryId = getLibraryParam(c);
        const insertableId = getInsertableParam(c);
        const { supportsFasten } = c.req.valid("json");

        const row = await db
            .select({
                name: insertables.name,
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                elementType: insertables.elementType,
                buildIssues: insertables.buildIssues
            })
            .from(insertables)
            .where(inLibrary(libraryId, insertableId))
            .get();
        if (!row)
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);

        // Off asks nothing of Onshape; on finds the connector again, in case it moved.
        const found = supportsFasten
            ? await findMateConnector(
                  await c.var.getOnshapeApi(),
                  toElementPath(row),
                  row.elementType
              )
            : undefined;
        if (supportsFasten && !found) {
            throw handledError(
                `${row.name} has no mate connector to fasten to.`,
                HttpStatus.BAD_REQUEST
            );
        }
        const fasten = decideFasten(found);

        await db
            .update(insertables)
            .set({
                fastenDisabled: !supportsFasten,
                fastenInfo: fasten.fastenInfo,
                buildIssues: replaceBuildIssues(
                    row.buildIssues,
                    FASTEN_ISSUE_TYPES,
                    fasten.buildIssues
                )
            })
            .where(eq(insertables.id, insertableId));

        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/indexing/library/:libraryId/insertable/:insertableId */
insertableRoutes.post(
    "/indexing" + libraryRoute() + insertableRoute(),
    requireEditorMiddleware,
    validate("json", indexingBody),
    async (c) => {
        await reindex(
            c,
            getLibraryParam(c),
            getInsertableParam(c),
            c.req.valid("json")
        );
        return c.json({ success: true });
    }
);

/** Probes before writing anything, so a failure writes nothing. */
async function reindex(
    c: AppContext,
    libraryId: LibraryId,
    insertableId: string,
    settings: IndexingSettings
): Promise<void> {
    const db = getDb(c.env.DB);
    const row = await db
        .select({
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            elementType: insertables.elementType,
            isOpenComposite: insertables.isOpenComposite,
            buildIssues: insertables.buildIssues,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(inLibrary(libraryId, insertableId))
        .get();
    if (!row) {
        throw internalError("Insertable not found", HttpStatus.NOT_FOUND);
    }
    const parameters = row.parameters ?? [];
    const indexing = decideIndexing(parameters, settings);
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

    const buildIssues = replaceBuildIssues(
        row.buildIssues,
        INDEXING_ISSUE_TYPES,
        [...indexed.buildIssues, ...indexing.buildIssues]
    );

    const writes: BatchItem<"sqlite">[] = [
        db
            .update(insertables)
            .set({
                ...settings,
                partMetadata: indexed.partMetadata,
                buildIssues
            })
            .where(eq(insertables.id, insertableId))
    ];
    if (parameters.length > 0) {
        writes.push(
            db
                .update(configurations)
                .set({ records: indexed.records })
                .where(eq(configurations.insertableId, insertableId))
        );
    }
    await db.batch([writes[0], ...writes.slice(1)]);

    // Before the bump, which makes /search-db immutable for a year.
    await rebuildSearchDb(c.env.BLOB, db, libraryId);
    await bumpLibraryVersion(db, libraryId);
}

/** Rejected here if half-built, rather than reaching Onshape as a bad url. */
const targetPathSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    elementId: z.string().min(1)
});

const insertBody = z.object({
    targetPath: targetPathSchema,
    selection: selectionSchema,
    isFavorite: z.boolean().default(false),
    isQuickInsert: z.boolean().default(false),
    // Defaulted so an older client can't fail the tracking batch on NOT NULL.
    source: z.enum(UseSource).default(UseSource.BROWSE)
});

const addToAssemblyBody = insertBody.extend({
    fasten: z.boolean().default(false),
    /** The insert location marker's instance id, when the assembly has one. */
    insertLocationId: z.string().optional()
});

/** POST /api/add-to-part-studio/insertable/:insertableId */
insertableRoutes.post(
    "/add-to-part-studio" + insertableRoute(),
    requireSignInMiddleware,
    validate("json", insertBody),
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
                libraryId: insertables.libraryId,
                fastenInfo: insertables.fastenInfo
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
            row.fastenInfo !== null,
            selection,
            parameters
        );

        const result = await retryOnServerError(() =>
            addPartStudioFeature(onshapeApi, targetPath, feature.getFeature())
        );

        await recordRecentInsert(c, {
            libraryId: row.libraryId,
            insertableId,
            selection,
            parameters
        });
        await trackInsert(c, {
            libraryId: row.libraryId,
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
        });

        return c.json({
            featureId: result.feature?.featureId
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

        // Only the overrides: a whole selection can exceed what Onshape accepts.
        let configuration = selection
            ? encodeConfiguration(onshapeOverrides(selection, parameters))
            : undefined;

        // Onshape won't insert a part studio from an empty configuration (an assembly
        // is fine), so name one parameter at its default.
        if (
            selection &&
            configuration === "" &&
            row.elementType === ElementType.PART_STUDIO
        ) {
            const [first] = parameters;
            configuration = encodeConfiguration({
                [first.id]: selection[first.id]
            });
        }

        // Resolved here, since the marker moves whenever someone drags it.
        const transform = body.insertLocationId
            ? await getInsertLocationTransform(
                  onshapeApi,
                  targetPath,
                  body.insertLocationId
              )
            : undefined;

        const result = await retryOnServerError(() =>
            addElementToAssembly(
                onshapeApi,
                targetPath,
                sourcePath,
                row.elementType,
                { configuration, partTypes, transform }
            )
        );

        // The part is in the assembly whatever the fasten does.
        await recordRecentInsert(c, {
            libraryId: row.libraryId,
            insertableId,
            selection,
            parameters
        });

        // Every path below records the insert exactly once.
        const track = (fasten: boolean) =>
            trackInsert(c, {
                libraryId: row.libraryId,
                path: sourcePath,
                insertableId,
                targetElementType: ElementType.ASSEMBLY,
                selection,
                parameters,
                isFavorite: body.isFavorite,
                isQuickInsert: body.isQuickInsert,
                source: body.source,
                fasten
            });

        if (!body.fasten) {
            await track(false);
            return c.json({} satisfies InsertOut);
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

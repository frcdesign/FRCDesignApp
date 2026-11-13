import { and, eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { type Db, getDb } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import { handledError } from "../../lib/api-error";
import { getApp } from "../../lib/context";
import { ElementType } from "../../lib/onshape/element-type";
import {
    deleteAssemblyInstances,
    elementInstance,
    getAssembly,
    insertTransformedInstances
} from "../../lib/onshape/endpoints/assemblies";
import { PartType } from "../../lib/onshape/endpoints/documents";
import { toElementPath } from "../../lib/onshape/path";
import { type OnshapeAssemblyDefinition } from "../../lib/onshape/types";
import { validate } from "../../lib/validate";
import { runInBackground } from "../../lib/background";
import { recordInserts } from "../analytics/tracking";
import { UseSource } from "../analytics/usage";
import { requireSignInMiddleware } from "../auth/guards";
import { type SelectedEntity } from "../auto-assembly/contract";
import { entitySchema, MAX_SELECTIONS } from "../auto-assembly/picked";
import {
    onshapeOverrides,
    partStudioInsertOverrides
} from "../configurations/selection";
import { encodeConfiguration } from "../configurations/utils";
import { selectionSchema } from "../library/insertables/read-selection";
import { type EditCheckOut, type EditPartsOut } from "./contract";
import { planEdit, topInstance } from "./targets";

export const editPartsRoutes = getApp();

/** An assembly in a workspace: only one can be edited. */
const assemblySchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.literal("w"),
    elementId: z.string().min(1)
});

const checkBody = z.object({
    assembly: assemblySchema,
    parts: z.array(entitySchema).max(MAX_SELECTIONS),
    changes: selectionSchema
});

const editBody = checkBody.extend({
    parts: z.array(entitySchema).min(1).max(MAX_SELECTIONS),
    changes: z.record(z.string(), z.string()),
    applyToAll: z.boolean()
});

/** The library part the first pick is a copy of, as the library holds it now. */
async function findPart(
    db: Db,
    definition: OnshapeAssemblyDefinition,
    parts: SelectedEntity[]
) {
    const instance = parts[0] && topInstance(definition, parts[0]);
    if (!instance?.documentId || !instance.elementId) {
        return undefined;
    }
    const row = await db
        .select({
            id: insertables.id,
            libraryId: insertables.libraryId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            elementType: insertables.elementType,
            isOpenComposite: insertables.isOpenComposite,
            fastenInfo: insertables.fastenInfo,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(
            and(
                eq(insertables.documentId, instance.documentId),
                eq(insertables.elementId, instance.elementId)
            )
        )
        .get();
    return row && { ...row, parameters: row.parameters ?? [] };
}

/**
 * POST /api/edit-parts/check — which library part the picks are copies of,
 * its configuration now, how many copies an edit would reach, and what's
 * wrong with each pick.
 */
editPartsRoutes.post(
    "/edit-parts/check",
    requireSignInMiddleware,
    validate("json", checkBody),
    async (c) => {
        const { assembly, parts, changes } = c.req.valid("json");
        const none: EditCheckOut = {
            pickedCount: 0,
            matchingCount: 0,
            problems: []
        };
        if (parts.length === 0) {
            return c.json(none);
        }
        const definition = await getAssembly(
            await c.var.getOnshapeApi(),
            assembly
        );
        const part = await findPart(getDb(c.env.DB), definition, parts);
        if (!part) {
            return c.json(none);
        }
        const plan = planEdit({
            definition,
            source: part,
            parameters: part.parameters,
            parts,
            changes: changes ?? {},
            applyToAll: false
        });
        return c.json({
            insertableId: part.id,
            selection: plan.targets[0]?.copy.selection,
            pickedCount: plan.pickedCount,
            matchingCount: plan.matchingCount,
            problems: plan.problems
        } satisfies EditCheckOut);
    }
);

/**
 * POST /api/edit-parts — gives each copy its new configuration. Onshape's API
 * can't change an instance's configuration, so each copy is inserted again
 * where it sits and the old one deleted, which takes its mates with it.
 */
editPartsRoutes.post(
    "/edit-parts",
    requireSignInMiddleware,
    validate("json", editBody),
    async (c) => {
        const { assembly, parts, changes, applyToAll } = c.req.valid("json");
        const onshapeApi = await c.var.getOnshapeApi();
        const db = getDb(c.env.DB);
        const definition = await getAssembly(onshapeApi, assembly);
        const part = await findPart(db, definition, parts);
        if (!part) {
            throw handledError("Not a library part", HttpStatus.BAD_REQUEST);
        }
        const { parameters } = part;
        const { targets } = planEdit({
            definition,
            source: part,
            parameters,
            parts,
            changes,
            applyToAll
        });
        if (targets.length === 0) {
            throw handledError(
                "No part can take this change",
                HttpStatus.BAD_REQUEST
            );
        }

        const sourcePath = toElementPath(part);
        const partTypes = part.isOpenComposite
            ? [PartType.COMPOSITE_PARTS]
            : [PartType.PARTS, PartType.COMPOSITE_PARTS];
        // The new copies first, so a failure leaves the old ones in place.
        await insertTransformedInstances(
            onshapeApi,
            assembly,
            targets.map(({ copy, selection }) => ({
                instances: [
                    elementInstance(sourcePath, part.elementType, {
                        configuration: encodeConfiguration(
                            part.elementType === ElementType.PART_STUDIO
                                ? partStudioInsertOverrides(
                                      selection,
                                      parameters
                                  )
                                : onshapeOverrides(selection, parameters)
                        ),
                        partTypes
                    })
                ],
                transform: copy.transform
            }))
        );
        await deleteAssemblyInstances(
            onshapeApi,
            assembly,
            targets.flatMap(({ copy }) => copy.instanceIds),
            "Edit parts"
        );

        await runInBackground(c, "record an edit's inserts", async () =>
            recordInserts(
                db,
                await c.var.getUserId(),
                targets.map(({ selection }) => ({
                    libraryId: part.libraryId,
                    path: sourcePath,
                    insertableId: part.id,
                    targetElementType: ElementType.ASSEMBLY,
                    selection: parameters.length > 0 ? selection : undefined,
                    parameters,
                    // Not looked up: an edit starts from the assembly, not a list
                    isFavorite: false,
                    isQuickInsert: false,
                    source: UseSource.EDIT,
                    fasten: false,
                    fastenable: part.fastenInfo !== null,
                    preselected: false
                }))
            )
        );

        return c.json({ updated: targets.length } satisfies EditPartsOut);
    }
);

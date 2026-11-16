import { and, eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import z from "zod";
import { getDb, type Db } from "../../db/client";
import { insertables } from "../../db/schema";
import { internalError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { type AppContext, getApp } from "../../lib/context";
import {
    getTranslation,
    downloadExternalData,
    OnshapeTranslationState,
    type OnshapeTranslation,
    startStepExport
} from "../../lib/onshape/endpoints/translations";
import { toElementPath } from "../../lib/onshape/path";
import { getInsertableParam, insertableRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { trackDownload } from "../analytics/tracking";
import { CLIENT_USE_SOURCES, UseSource } from "../analytics/usage";
import { onshapeOverrides } from "../configurations/selection";
import { encodeConfiguration } from "../configurations/utils";
import {
    readSelection,
    selectionSchema
} from "../library/insertables/read-selection";
import {
    StepExportState,
    type StepExportOut,
    type StepExportStatus
} from "./contract";

export const downloadRoutes = getApp();

downloadRoutes.use("/step-export/*", cacheMiddleware());

const stepExportBody = z.object({
    selection: selectionSchema,
    isFavorite: z.boolean().default(false),
    source: z.enum(CLIENT_USE_SOURCES).default(UseSource.BROWSE)
});

/** POST /api/step-export/insertable/:insertableId */
downloadRoutes.post(
    "/step-export" + insertableRoute(),
    requireSignInMiddleware,
    validate("json", stepExportBody),
    async (c) => {
        const insertableId = getInsertableParam(c);
        const db = getDb(c.env.DB);
        const row = await db
            .select({
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId,
                elementType: insertables.elementType,
                name: insertables.name,
                libraryId: insertables.libraryId
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row) {
            throw internalError("Insertable not found", HttpStatus.NOT_FOUND);
        }

        const body = c.req.valid("json");
        const { selection, parameters } = await readSelection(
            db,
            insertableId,
            body.selection
        );
        const translation = await startStepExport(
            await c.var.getOnshapeApi(),
            toElementPath(row),
            row.elementType,
            {
                configuration: selection
                    ? encodeConfiguration(
                          onshapeOverrides(selection, parameters)
                      )
                    : "",
                destinationName: row.name
            }
        );
        await trackDownload(c, {
            libraryId: row.libraryId,
            path: toElementPath(row),
            insertableId,
            selection,
            parameters,
            isFavorite: body.isFavorite,
            source: body.source
        });
        return c.json({
            translationId: translation.id
        } satisfies StepExportOut);
    }
);

/** GET /api/step-export/:translationId */
downloadRoutes.get(
    "/step-export/:translationId",
    requireSignInMiddleware,
    async (c) => {
        const translation = await readLibraryTranslation(c);
        return c.json({
            state: toExportState(translation)
        } satisfies StepExportStatus);
    }
);

/** GET /api/step-export/:translationId/file */
downloadRoutes.get(
    "/step-export/:translationId/file",
    requireSignInMiddleware,
    async (c) => {
        const translation = await readLibraryTranslation(c);
        const [externalDataId] = translation.resultExternalDataIds ?? [];
        if (
            translation.requestState !== OnshapeTranslationState.DONE ||
            !externalDataId
        ) {
            throw internalError("Export not finished", HttpStatus.CONFLICT);
        }
        const file = await downloadExternalData(
            await c.var.getOnshapeApi(),
            translation.documentId,
            externalDataId
        );
        const name = await findInsertableName(getDb(c.env.DB), translation);
        return new Response(file.body, {
            headers: {
                "Content-Type": "model/step",
                "Content-Disposition": contentDisposition(`${name}.step`),
                "Cache-Control": "private, no-store"
            }
        });
    }
);

/**
 * Onshape scopes a translation to whoever started it; this also keeps the
 * routes from fetching anything but a library document's export.
 */
async function readLibraryTranslation(
    c: AppContext
): Promise<OnshapeTranslation> {
    const translationId = c.req.param("translationId");
    if (!translationId) {
        throw new Error("Missing translationId route param");
    }
    const translation = await getTranslation(
        await c.var.getOnshapeApi(),
        translationId
    );
    const isLibraryDocument = await getDb(c.env.DB)
        .select({ id: insertables.id })
        .from(insertables)
        .where(eq(insertables.documentId, translation.documentId))
        .get();
    if (!isLibraryDocument) {
        throw internalError("Export not found", HttpStatus.NOT_FOUND);
    }
    return translation;
}

function toExportState(translation: OnshapeTranslation): StepExportState {
    switch (translation.requestState) {
        case OnshapeTranslationState.ACTIVE:
            return StepExportState.ACTIVE;
        case OnshapeTranslationState.DONE:
            return StepExportState.DONE;
        case OnshapeTranslationState.FAILED:
            console.error(
                `STEP export ${translation.id} failed: ${translation.failureReason}`
            );
            return StepExportState.FAILED;
    }
}

async function findInsertableName(
    db: Db,
    translation: OnshapeTranslation
): Promise<string> {
    const row = translation.requestElementId
        ? await db
              .select({ name: insertables.name })
              .from(insertables)
              .where(
                  and(
                      eq(insertables.documentId, translation.documentId),
                      eq(insertables.elementId, translation.requestElementId)
                  )
              )
              .get()
        : undefined;
    return row?.name ?? "export";
}

/** A plain fallback for old clients beside the UTF-8 name every browser now reads. */
function contentDisposition(fileName: string): string {
    const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

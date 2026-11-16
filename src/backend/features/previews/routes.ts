import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { handledError } from "../../lib/api-error";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getInsertableParam, insertableRoute } from "../../lib/route-params";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import {
    normalizeSelection,
    renderOverrides,
    toKey,
    toSelection
} from "../configurations/selection";
import { decodeConfiguration } from "../configurations/utils";
import { renderTargetOf } from "../thumbnails/render";
import { encodePreviewMesh, PREVIEW_MESH_CONTENT_TYPE } from "./contract";
import { getStoredPreview, previewKey, putStoredPreview } from "./store";
import { tessellate } from "./tessellate";

export const previewRoutes = getApp();

const previewQuery = z.object({
    /** The version the caller expects, so a url is never answered with another version's mesh. */
    microversionId: z.string().min(1),
    configuration: z.string().default("")
});

/**
 * GET /api/preview-mesh/insertable/:insertableId?microversionId=&configuration=&v=
 * One configuration's mesh, made from Onshape's tessellation the first time
 * anyone asks for it, under the caller's session.
 */
previewRoutes.get(
    "/preview-mesh" + insertableRoute(),
    requireSignInMiddleware,
    cacheMiddleware(CachePolicy.PRIVATE_CACHE),
    validate("query", previewQuery),
    async (c) => {
        const query = c.req.valid("query");
        const target = await renderTargetOf(c, getInsertableParam(c));
        if (target.microversionId !== query.microversionId) {
            throw handledError(
                "This part has changed since its preview was asked for.",
                HttpStatus.NOT_FOUND
            );
        }
        const { parameters } = target;
        const selection = normalizeSelection(
            toSelection(decodeConfiguration(query.configuration), parameters),
            parameters
        );
        const key = previewKey(
            target.path.elementId,
            target.microversionId,
            toKey(selection, parameters)
        );
        let mesh = await getStoredPreview(c.env.BLOB, key);
        if (!mesh) {
            const tessellated = await tessellate(
                await c.var.getOnshapeApi(),
                target.path,
                renderOverrides(selection, parameters)
            );
            // Never stored, so an answer read wrong is asked for again
            if (tessellated.indices.length === 0) {
                throw handledError(
                    "This configuration has nothing to preview.",
                    HttpStatus.NOT_FOUND
                );
            }
            mesh = encodePreviewMesh(tessellated);
            await putStoredPreview(c.env.BLOB, key, mesh);
        }
        return c.body(mesh, HttpStatus.OK, {
            "Content-Type": PREVIEW_MESH_CONTENT_TYPE
        });
    }
);

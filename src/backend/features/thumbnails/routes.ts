import { z } from "zod";
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { validate } from "../../lib/validate";
import { CachePolicy, setCache } from "../../lib/cache";
import { getApp } from "../../lib/context";

import { type RenderOut, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";
import { requestRender } from "./render";
import {
    requireEditorMiddleware,
    requireSignInMiddleware
} from "../auth/guards";
import {
    getInsertableParam,
    getLibraryParam,
    insertableRoute,
    libraryRoute
} from "../../lib/route-params";
import { getDb } from "../../db/client";
import { reloadGroupThumbnail, reloadInsertableThumbnail } from "./reload";

export const thumbnailRoutes = getApp();

const storedThumbnailParams = z.object({
    size: z.enum(ThumbnailSize),
    elementId: z.string().min(1)
});

/** Absent means the element default, which is what `""` encodes. */
const configurationKeyQuery = z.string().default(DEFAULT_CONFIGURATION_KEY);

const storedThumbnailQuery = z.object({
    /** The microversion, part of the key — which is what makes a hit immutable. */
    v: z.string().min(1),
    configurationKey: configurationKeyQuery
});

/** GET /api/thumbnail/:size/:elementId?v=&configurationKey= */
thumbnailRoutes.get(
    "/thumbnail/:size/:elementId",
    validate("param", storedThumbnailParams),
    validate("query", storedThumbnailQuery),
    async (c) => {
        const { size, elementId } = c.req.valid("param");
        const { v: microversionId, configurationKey } = c.req.valid("query");
        const object = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size, configurationKey)
        );
        if (object) {
            // The url pins microversion and configuration.
            return setCache(
                thumbnailResponse(object),
                CachePolicy.PUBLIC_CACHE
            );
        }

        // Never the element's default, which would show the wrong part.
        return notRenderedYet();
    }
);

const renderBody = z.object({ configurationKey: z.string().min(1) });

/**
 * POST /api/render-thumbnail/insertable/:insertableId: starts rendering a
 * configuration the stored thumbnail route missed. Signed in, since the render
 * calls Onshape as the caller.
 */
thumbnailRoutes.post(
    "/render-thumbnail" + insertableRoute(),
    requireSignInMiddleware,
    validate("json", renderBody),
    async (c) => {
        const { configurationKey } = c.req.valid("json");
        const status = await requestRender(c, {
            insertableId: getInsertableParam(c),
            configurationKey
        });
        return c.json({ status } satisfies RenderOut);
    }
);

/** Nothing to serve yet, and a render landing later must not be shadowed. */
function notRenderedYet(): Response {
    return setCache(
        new Response(null, { status: HttpStatus.NOT_FOUND }),
        CachePolicy.NO_CACHE
    );
}

function thumbnailResponse(object: R2ObjectBody): Response {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
}

const reloadThumbnailBody = z.object({
    /** Exactly one: a group's own thumbnail, or one element's. */
    groupId: z.string().min(1).optional(),
    insertableId: z.string().min(1).optional()
});

/** POST /api/reload-thumbnail/library/:libraryId: refetches one thumbnail, since loads don't wait for them. */
thumbnailRoutes.post(
    "/reload-thumbnail" + libraryRoute(),
    requireEditorMiddleware,
    validate("json", reloadThumbnailBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { groupId, insertableId } = c.req.valid("json");
        const db = getDb(c.env.DB);
        const onshapeApi = await c.var.getOnshapeApi();

        if (insertableId) {
            await reloadInsertableThumbnail(
                db,
                c.env.BLOB,
                onshapeApi,
                libraryId,
                insertableId
            );
        } else if (groupId) {
            await reloadGroupThumbnail(
                db,
                c.env.BLOB,
                onshapeApi,
                libraryId,
                groupId
            );
        } else {
            throw handledError(
                "Name a group or an element to reload.",
                HttpStatus.BAD_REQUEST
            );
        }
        return c.json({ success: true });
    }
);

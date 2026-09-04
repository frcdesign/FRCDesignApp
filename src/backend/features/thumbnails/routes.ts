import { z } from "zod";
import { HttpStatus } from "http-status-ts";
import { validate } from "../../lib/validate";
import { CachePolicy, setCache } from "../../lib/cache";
import { getApp } from "../../lib/context";

import { ThumbnailSize } from "./types";
import { THUMBNAIL_FALLBACK_HEADER, thumbnailKey } from "./keys";
import { ELEMENT_DEFAULT_KEY } from "../configurations/selection";

import type { AppContext } from "../../lib/context";
import type { ThumbnailWorkflowParams } from "./workflow";
import { getSessionId } from "../auth/session";

export const thumbnailRoutes = getApp();

const storedThumbnailParams = z.object({
    size: z.enum(ThumbnailSize),
    elementId: z.string().min(1)
});

/** Absent means the element default, which is what `""` encodes. */
const configurationKeyQuery = z.string().default(ELEMENT_DEFAULT_KEY);

const storedThumbnailQuery = z.object({
    /** The microversion, part of the key — which is what makes a hit immutable. */
    v: z.string().min(1),
    configurationKey: configurationKeyQuery,
    renderThumbnail: z.stringbool().default(false),
    /** The insertable to render from; only sent with `renderThumbnail`. */
    insertableId: z.string().optional()
});

/**
 * GET /api/thumbnail/:size/:elementId?v=&configurationKey=&renderThumbnail=
 * — an unrendered configuration falls back to the element default, and
 * `renderThumbnail` starts the real render.
 *
 * Each answer says how it may be cached rather than the route saying it once:
 * stored bytes are pinned by the url, a stand-in and a miss are not.
 */
thumbnailRoutes.get(
    "/thumbnail/:size/:elementId",
    validate("param", storedThumbnailParams),
    validate("query", storedThumbnailQuery),
    async (c) => {
        const { size, elementId } = c.req.valid("param");
        const {
            v: microversionId,
            configurationKey,
            renderThumbnail,
            insertableId
        } = c.req.valid("query");
        const object = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size, configurationKey)
        );
        if (object) {
            // The microversion and the configuration are both in the url, so
            // these bytes are the only ones it will ever mean.
            return setCache(
                thumbnailResponse(object),
                CachePolicy.PUBLIC_CACHE
            );
        }

        if (configurationKey === ELEMENT_DEFAULT_KEY) {
            return notRenderedYet();
        }

        if (renderThumbnail && insertableId) {
            await startConfigurationRender(c, {
                insertableId,
                configurationKey
            });
        }

        // Stand in with the default configuration until the real render lands.
        const fallback = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size)
        );
        if (!fallback) {
            return notRenderedYet();
        }
        const response = thumbnailResponse(fallback);
        response.headers.set(THUMBNAIL_FALLBACK_HEADER, "1");
        // Unlike a hit, this url does not pin these bytes: the real render can
        // land at any moment, and whoever asks next should see it.
        return setCache(response, CachePolicy.NO_CACHE);
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

/**
 * Concurrent requests can each start a run. Rare, and the workflow skips a
 * render that is already stored, which a reused id would rule out permanently.
 */
async function startConfigurationRender(
    c: AppContext,
    params: Omit<ThumbnailWorkflowParams, "sessionId">
): Promise<void> {
    try {
        // The render runs later, under this caller's Onshape tokens.
        await c.env.THUMBNAIL_WORKFLOW.create({
            params: { ...params, sessionId: getSessionId(c) }
        });
    } catch {
        // Never fatal: the caller still has the default thumbnail to serve.
    }
}

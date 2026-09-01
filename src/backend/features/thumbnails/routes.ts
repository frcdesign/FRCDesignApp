import { z } from "zod";
import { validate } from "../../lib/validate";
import { CachePolicy, cacheMiddleware, setUncacheable } from "../../lib/cache";
import { getApp } from "../../lib/context";

import { ThumbnailSize } from "./types";
import { THUMBNAIL_FALLBACK_HEADER, thumbnailKey } from "./keys";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY,
    canonicalConfigurationKey
} from "../configurations/canonical";

import type { AppContext } from "../../lib/context";
import type { ThumbnailWorkflowParams } from "./workflow";
import { getSessionId } from "../auth/session";

export const thumbnailRoutes = getApp();

const storedThumbnailParams = z.object({
    size: z.enum(ThumbnailSize),
    elementId: z.string().min(1)
});

/** Absent means the element default, which is what `""` encodes. */
const canonicalConfigurationQuery = z
    .string()
    .default(DEFAULT_CANONICAL_CONFIGURATION);

const storedThumbnailQuery = z.object({
    /** The microversion, part of the key — which is what makes a hit immutable. */
    v: z.string().min(1),
    configuration: canonicalConfigurationQuery,
    renderThumbnail: z.stringbool().default(false),
    /** The insertable to render from; only sent with `renderThumbnail`. */
    insertableId: z.string().optional()
});

/**
 * GET /api/thumbnail/:size/:elementId?v=&configuration=&renderThumbnail= — an
 * unrendered configuration falls back to the element default, and
 * `renderThumbnail` starts the real render.
 */
thumbnailRoutes.get(
    "/thumbnail/:size/:elementId",
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    validate("param", storedThumbnailParams),
    validate("query", storedThumbnailQuery),
    async (c) => {
        const { size, elementId } = c.req.valid("param");
        const {
            v: microversionId,
            configuration: canonicalConfiguration,
            renderThumbnail,
            insertableId
        } = c.req.valid("query");
        const configurationKey = canonicalConfigurationKey(
            canonicalConfiguration
        );

        const object = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size, configurationKey)
        );
        if (object) {
            return thumbnailResponse(object);
        }

        if (configurationKey === DEFAULT_CONFIGURATION_KEY) {
            return c.notFound();
        }

        if (renderThumbnail && insertableId) {
            await startConfigurationRender(c, {
                insertableId,
                canonicalConfiguration
            });
        }

        // Stand in with the default configuration until the real render lands.
        const fallback = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size)
        );
        if (!fallback) {
            return c.notFound();
        }
        // Unlike a hit, this url does not pin these bytes: the real render can
        // land at any moment, and whoever asks next should see it.
        setUncacheable(c);
        const response = thumbnailResponse(fallback);
        response.headers.set(THUMBNAIL_FALLBACK_HEADER, "1");
        return response;
    }
);

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

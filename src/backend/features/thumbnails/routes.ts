import { z } from "zod";
import { HttpStatus } from "http-status-ts";
import { validate } from "../../lib/validate";
import { CachePolicy, setCache } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";

import { ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";

import { thumbnailRunId, type ThumbnailWorkflowParams } from "./workflow";
import { getSessionId } from "../auth/session";

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
    configurationKey: configurationKeyQuery,
    renderThumbnail: z.stringbool().default(false),
    /** The insertable to render from; only sent with `renderThumbnail`. */
    insertableId: z.string().optional()
});

/**
 * GET /api/thumbnail/:size/:elementId?v=&configurationKey=&renderThumbnail=
 * Each answer caches itself: stored bytes are pinned by the url, a miss is not.
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

        // A configuration this has not rendered is a miss, not the element's
        // own thumbnail: standing that in shows a part the caller did not ask
        // for, and a favorite pinned to a configuration would show the wrong
        // one. A caller that wants the element default asks for it by key.
        if (
            configurationKey !== DEFAULT_CONFIGURATION_KEY &&
            renderThumbnail &&
            insertableId
        ) {
            await startConfigurationRender(c, {
                insertableId,
                configurationKey,
                microversionId
            });
        }
        return notRenderedYet();
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
 * Idempotent, so a client can poll this route as often as it likes: the id is
 * the render, and `createBatch` skips an instance already inside its retention
 * window rather than starting a second one or throwing. A run that failed frees
 * its id when that window ends, which is the only retry a dead render gets.
 */
async function startConfigurationRender(
    c: AppContext,
    params: Omit<ThumbnailWorkflowParams, "sessionId">
): Promise<void> {
    try {
        // The render runs later, under this caller's Onshape tokens.
        await c.env.THUMBNAIL_WORKFLOW.createBatch([
            {
                id: await thumbnailRunId(params),
                params: { ...params, sessionId: getSessionId(c) }
            }
        ]);
    } catch {
        // Never fatal: the caller just gets a miss until the render lands.
    }
}

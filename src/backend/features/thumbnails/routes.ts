import { z } from "zod";
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { validate } from "../../lib/validate";
import { CachePolicy, setCache } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";

import { RenderSource, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";

import { requestThumbnails, type ThumbnailRequest } from "./renderer";
import { getSessionId } from "../auth/session";
import { requireEditorMiddleware } from "../auth/guards";
import { getDb } from "../../db/client";
import { reloadGroupThumbnail, reloadInsertableThumbnail } from "./reload";

export const thumbnailRoutes = getApp();

const storedThumbnailParams = z.object({
    size: z.enum(ThumbnailSize),
    elementId: z.string().min(1)
});

/** Absent means the element default, which is what `""` encodes. */
const configurationKeyQuery = z.string().default(DEFAULT_CONFIGURATION_KEY);

/**
 * Only the two sources a client can legitimately be. The insert menu may take
 * the render thread from whatever holds it, so this is not free-form.
 */
const renderSourceQuery = z.enum([RenderSource.INSERT_MENU, RenderSource.ROW]);

const storedThumbnailQuery = z.object({
    /** The microversion, part of the key — which is what makes a hit immutable. */
    v: z.string().min(1),
    configurationKey: configurationKeyQuery,
    /** Absent means serve what is stored and queue nothing. */
    renderSource: renderSourceQuery.optional(),
    /** The insertable to render from; only sent with `renderSource`. */
    insertableId: z.string().optional()
});

/**
 * GET /api/thumbnail/:size/:elementId?v=&configurationKey=&renderSource=
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
            renderSource,
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
            renderSource &&
            insertableId
        ) {
            await queueConfigurationRender(
                c,
                {
                    insertableId,
                    elementId,
                    configurationKey,
                    microversionId
                },
                renderSource
            );
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
 * Queues the render and returns; the client polls this route until the bytes
 * land. Polling is free — the queue names a job by the key it will write, so
 * asking twice is asking once and never disturbs a render already running.
 */
async function queueConfigurationRender(
    c: AppContext,
    request: ThumbnailRequest,
    source: RenderSource
): Promise<void> {
    try {
        // Read first, so a caller with no session queues nothing: the render
        // runs later, under this caller's Onshape tokens.
        const sessionId = getSessionId(c);
        const userId = await c.var.getUserId();
        await requestThumbnails(c.env, { userId, sessionId }, request, source);
    } catch {
        // Never fatal: the caller just gets a miss until the render lands.
    }
}

const reloadThumbnailBody = z.object({
    /** Exactly one: a group's own thumbnail, or one element's. */
    groupId: z.string().min(1).optional(),
    insertableId: z.string().min(1).optional()
});

/**
 * POST /api/reload-thumbnail
 *
 * Asks Onshape for a thumbnail again and replaces what is stored. A load does
 * not wait for one, so a thumbnail that was not there at the time stays missing
 * until the next reload of the whole document — this is the way to ask for just
 * the one.
 */
thumbnailRoutes.post(
    "/reload-thumbnail",
    requireEditorMiddleware,
    validate("json", reloadThumbnailBody),
    async (c) => {
        const { groupId, insertableId } = c.req.valid("json");
        const db = getDb(c.env.DB);
        const onshapeApi = await c.var.getOnshapeApi();

        if (insertableId) {
            await reloadInsertableThumbnail(
                db,
                c.env.BLOB,
                onshapeApi,
                insertableId
            );
        } else if (groupId) {
            await reloadGroupThumbnail(db, c.env.BLOB, onshapeApi, groupId);
        } else {
            throw handledError(
                "Name a group or an element to reload.",
                HttpStatus.BAD_REQUEST
            );
        }
        return c.json({ success: true });
    }
);

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
 * How long a failed render keeps its id. The account default is the full
 * retention period — 30 days on a paid plan — and the id is what stops a second
 * run, so a render that failed under a session that has since gone would never
 * get one carrying a live one. Long enough that polling cannot spin up runs
 * back to back.
 */
const ERROR_RETENTION = "1 hour";

/** A run in one of these has stopped for good, so the render must be asked again. */
const DEAD_STATUSES: ReadonlySet<InstanceStatus["status"]> = new Set([
    "errored",
    "terminated"
]);

/**
 * Idempotent, so a client can poll this route as often as it likes: the id is
 * the render, so asking twice is asking once.
 *
 * An id is held for the whole retention window whether its run worked or
 * failed, and the default window is the account maximum — 30 days on a paid
 * plan. A render that died once therefore answered 404 for as long as that
 * lasted, since nothing new could be started under its id. A dead run is
 * restarted instead, and {@link ERROR_RETENTION} bounds how long one that
 * cannot be revived that way holds its id.
 */
async function startConfigurationRender(
    c: AppContext,
    params: Omit<ThumbnailWorkflowParams, "sessionId">
): Promise<void> {
    try {
        // Read first, so a caller with no session starts nothing: the render
        // runs later, under this caller's Onshape tokens.
        const sessionId = getSessionId(c);
        const id = await thumbnailRunId(params);
        const started = await createRun(c.env.THUMBNAIL_WORKFLOW, id, {
            ...params,
            sessionId
        });
        if (!started) {
            await restartIfDead(c.env.THUMBNAIL_WORKFLOW, id);
        }
    } catch {
        // Never fatal: the caller just gets a miss until the render lands.
    }
}

/** Whether a run was started, as against the id already being held by one. */
async function createRun(
    workflow: Workflow<ThumbnailWorkflowParams>,
    id: string,
    params: ThumbnailWorkflowParams
): Promise<boolean> {
    try {
        const started = await workflow.createBatch([
            { id, params, retention: { errorRetention: ERROR_RETENTION } }
        ]);
        // An id inside its retention window is skipped and left out of the
        // result; the runtime types say it throws instead. Either way it is
        // held, and the difference does not matter to the caller.
        return started.length > 0;
    } catch {
        return false;
    }
}

/**
 * Restarts a run that has stopped without storing anything. Only reached for an
 * id something already holds, so it never asks after a run that is not there.
 *
 * A restart replays the run under the session it was created with, since there
 * is no way to hand it a newer one — which is what {@link ERROR_RETENTION} is
 * for when that session is what failed.
 */
async function restartIfDead(
    workflow: Workflow<ThumbnailWorkflowParams>,
    id: string
): Promise<void> {
    const run = await workflow.get(id);
    const { status } = await run.status();
    // Anything queued, running or waiting is left to finish, and a complete run
    // stored what it was asked for — under the microversion its row named,
    // which a request carrying an older one misses however often it is rerun.
    if (DEAD_STATUSES.has(status)) {
        await run.restart();
    }
}

/**
 * Renders a configuration's thumbnails. Onshape renders one when its bytes are
 * first asked for, answering 404 until they are ready, so the workflow asks
 * until they land and stores them; the route that started it serves them.
 *
 * An element's own thumbnail never comes through here: Onshape renders those
 * when a document is saved, and a load fetches them directly.
 */
import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import { getThumbnailFromId } from "../../lib/onshape/endpoints/thumbnails";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import { rateLimitDelay } from "../load/steps";
import { type ConfigurationKey } from "../configurations/contract";
import { ThumbnailSize } from "./contract";
import { putThumbnail } from "./store";
import { pushThumbnailRendered } from "../live/notify";

/** One stored size: where it goes, and what to ask Onshape for. */
export interface RenderTarget {
    size: ThumbnailSize;
    /** The R2 key, which is also what the route serves the size from. */
    key: string;
}

export interface RenderThumbnailParams {
    /** Resolved once by the route; fixed for an element and configuration. */
    thumbnailId: string;
    /** Both sizes, the one the asking surface shows first leading. */
    targets: RenderTarget[];
    /** What is told to clients waiting on the render once each size lands. */
    elementId: string;
    /** Tagged onto each stored object, for telling later what it depicts. */
    microversionId: string;
    configurationKey: ConfigurationKey;
    /** Whose Onshape tokens the render is asked for under. */
    sessionId: string;
}

/**
 * How long a render is waited on: a minute, at a steady five seconds a try —
 * renders normally land well inside that, and one that does not is abandoned
 * rather than left spending the account's allocation. A rate limit waits out
 * whatever Onshape says instead.
 */
const RENDER_RETRIES = {
    limit: 12,
    delay: (input: { error: Error }) =>
        rateLimitDelay(input.error) ?? ("5 seconds" as const),
    backoff: "constant" as const
};

export class RenderThumbnailWorkflow extends WorkflowEntrypoint<
    AppBindings,
    RenderThumbnailParams
> {
    async run(
        event: WorkflowEvent<RenderThumbnailParams>,
        step: WorkflowStep
    ): Promise<void> {
        const { targets } = event.payload;
        // One at a time: the second size is the same render, so it lands as
        // soon as the first has.
        for (const target of targets) {
            await step.do(
                `store-${target.size}`,
                { retries: RENDER_RETRIES },
                () => storeRender(this.env, event.payload, target)
            );
        }
    }
}

/** One try at a size; throws while Onshape is still rendering it. */
async function storeRender(
    env: AppBindings,
    params: RenderThumbnailParams,
    target: RenderTarget
): Promise<void> {
    if (await env.BLOB.head(target.key)) {
        return;
    }
    const onshapeApi = await getOnshapeApiFromSessionId(
        env.KV,
        params.sessionId
    );
    const thumbnail = await getThumbnailFromId(
        onshapeApi,
        params.thumbnailId,
        target.size
    );
    await putThumbnail(env.BLOB, target.key, thumbnail, {
        microversionId: params.microversionId,
        configurationKey: params.configurationKey
    });
    await pushThumbnailRendered(env, {
        elementId: params.elementId,
        microversionId: params.microversionId,
        configurationKey: params.configurationKey
    });
}

import type { WorkflowBackoff } from "cloudflare:workers";
import { OnshapeRateLimitError } from "../../lib/onshape/client";
import { type ThumbnailUrls } from "../thumbnails/contract";
import type { LoadContext } from "./context";

/**
 * Pinned because the platform's curve compounds with the callbacks below:
 * `backoff` defaults to exponential and multiplies what `delay` returned, which
 * turned the thumbnail poll's capped 120 seconds into 120 × 2^7 — a run waiting
 * 4h16m between attempts. Cloudflare documents the two settings separately and,
 * as far as I saw, not how they combine, so that is read off a run.
 */
const CONSTANT_BACKOFF: WorkflowBackoff = "constant";

/** The retry input a Workflow `delay` callback receives. */
interface RetryDelayInput {
    ctx: { attempt: number };
    error: Error;
}

/**
 * Spread added on top of Onshape's `Retry-After`. Every step caught in one
 * burst is handed the same number to wait, so without this they all wake at the
 * same instant and re-send together — the burst that earned the 429. Twenty
 * seconds trickles a full set of probe slots back in at a few per second.
 */
const RATE_LIMIT_JITTER_SECONDS = 20;

/**
 * How long Onshape asked us to wait plus jitter, or `null` when the error
 * wasn't a rate limit.
 */
function rateLimitDelay(error: Error): `${number} seconds` | null {
    if (!(error instanceof OnshapeRateLimitError)) {
        return null;
    }
    // Rounded: Workflows documents whole units, not fractional ones.
    const jitter = Math.round(Math.random() * RATE_LIMIT_JITTER_SECONDS);
    return `${error.retryAfterSeconds + jitter} seconds`;
}

/**
 * Retry delay honoring Onshape's `Retry-After` on a 429, with an
 * exponential-ish fallback for other transient errors.
 */
function onshapeRetryDelay(input: RetryDelayInput): `${number} seconds` {
    const rateLimited = rateLimitDelay(input.error);
    if (rateLimited) {
        return rateLimited;
    }
    const seconds = Math.min(10 * 2 ** (input.ctx.attempt - 1), 300);
    return `${seconds} seconds`;
}

/**
 * Every step that calls Onshape takes this. The platform default would retry
 * too, but on its own curve — a 429 carries a `Retry-After` and this is what
 * honors it. Five attempts, matching that default rather than shortening it.
 */
export const ONSHAPE_STEP_RETRIES = {
    limit: 5,
    delay: onshapeRetryDelay,
    backoff: CONSTANT_BACKOFF
};

/**
 * Three tries about ten seconds apart, honouring a rate limit when Onshape
 * asks for one. The workspace either has the thumbnail or does not; this only
 * covers Onshape still writing one out just after a save.
 */
const THUMBNAIL_RETRIES = {
    limit: 3,
    delay: onshapeRetryDelay,
    backoff: CONSTANT_BACKOFF
};

/**
 * Fetches an element's thumbnails and returns where they are stored, or `null`
 * when neither the version nor the workspace would give one up — which the
 * caller records as a build issue rather than failing the whole load.
 *
 * Bounded by the run's limiter: these are ordinary Onshape reads that start no
 * render, so what caps them is the rate limit rather than anything else.
 */
export async function uploadThumbnailsStep(
    ctx: LoadContext,
    name: string,
    upload: () => Promise<ThumbnailUrls>
): Promise<ThumbnailUrls | null> {
    try {
        return await ctx.step.do(name, { retries: THUMBNAIL_RETRIES }, () =>
            ctx.limit(upload)
        );
    } catch {
        return null;
    }
}

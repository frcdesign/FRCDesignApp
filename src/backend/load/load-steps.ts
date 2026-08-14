import { OnshapeRateLimitError } from "../onshape-api/onshape-api";
import type { ThumbnailUrls } from "../../shared/types";
import type { LoadContext } from "./load-common";

/** The retry input a Workflow `delay` callback receives. */
interface RetryDelayInput {
    ctx: { attempt: number };
    error: Error;
}

/**
 * How long Onshape asked us to wait, or `null` when the error wasn't a rate
 * limit.
 */
function rateLimitDelay(error: Error): `${number} seconds` | null {
    return error instanceof OnshapeRateLimitError
        ? `${error.retryAfterSeconds} seconds`
        : null;
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

export const ONSHAPE_STEP_RETRIES = {
    limit: 3,
    delay: onshapeRetryDelay
};

/** The first wait after a render isn't ready; each attempt doubles it. */
const THUMBNAIL_BASE_DELAY_SECONDS = 4;

/** The ceiling the doubling stops at. */
const THUMBNAIL_MAX_DELAY_SECONDS = 15 * 60;

/**
 * Retry delay for a step waiting on an Onshape render. Onshape renders
 * thumbnails asynchronously and gives no signal when one lands, so the step
 * polls: a plain doubling from four seconds up to a fifteen-minute ceiling.
 *
 * Starting tight is the point — most renders land within seconds, and a long
 * first wait leaves them sitting finished but unnoticed.
 *
 * A rate limit still overrides the curve. Onshape says how long to wait, and
 * asking again sooner only earns another 429.
 */
function thumbnailRetryDelay(input: RetryDelayInput): `${number} seconds` {
    const rateLimited = rateLimitDelay(input.error);
    if (rateLimited) {
        return rateLimited;
    }
    const seconds = Math.min(
        THUMBNAIL_BASE_DELAY_SECONDS * 2 ** (input.ctx.attempt - 1),
        THUMBNAIL_MAX_DELAY_SECONDS
    );
    return `${seconds} seconds`;
}

export const THUMBNAIL_STEP_RETRIES = {
    // 10 attempts: waits of 4s, 8s, 16s … 512s, then the 15 minute ceiling, for
    // roughly half an hour of polling before a render is given up on. Chosen to
    // hold that window steady against the starting delay: a longer first wait
    // covers the same span in fewer attempts.
    limit: 10,
    delay: thumbnailRetryDelay
};

/**
 * Uploads thumbnails in a single step with retrying, returning `null` when they
 * never showed up — the caller records that as a build issue rather than failing
 * the load.
 */
export async function uploadThumbnailsStep(
    ctx: LoadContext,
    name: string,
    uploadFn: () => Promise<ThumbnailUrls | null>
): Promise<ThumbnailUrls | null> {
    try {
        return await ctx.step.do(
            name,
            {
                retries: THUMBNAIL_STEP_RETRIES
            },
            async () => {
                const thumbnails = await uploadFn();
                if (!thumbnails) {
                    throw new Error("Thumbnails are not rendered yet.");
                }
                return thumbnails;
            }
        );
    } catch {
        return null;
    }
}

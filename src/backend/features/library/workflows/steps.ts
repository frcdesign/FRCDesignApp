import { OnshapeRateLimitError } from "../../../lib/onshape/client";
import type { ThumbnailUrls } from "../../thumbnails/types";
import { NoSuchConfigurationError } from "../../../lib/onshape/endpoints/thumbnails";
import type { LoadContext } from "./context";

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

/**
 * Onshape gives no signal when a render lands, so the step polls, doubling from
 * four seconds. A rate limit overrides the curve.
 */
function thumbnailRetryDelay(input: RetryDelayInput): `${number} seconds` {
    const rateLimited = rateLimitDelay(input.error);
    if (rateLimited) {
        return rateLimited;
    }
    // Nothing to wait for; burn the remaining attempts immediately.
    if (input.error instanceof NoSuchConfigurationError) {
        return "0 seconds";
    }
    const seconds = THUMBNAIL_BASE_DELAY_SECONDS * 2 ** (input.ctx.attempt - 1);
    return `${seconds} seconds`;
}

export const THUMBNAIL_STEP_RETRIES = {
    // 4s, 8s … 512s: a bit over seventeen minutes of polling, which a slow
    // Onshape render is worth waiting out.
    limit: 9,
    delay: thumbnailRetryDelay
};

/**
 * Returns `null` when the thumbnails never showed up, which the caller records
 * as a build issue rather than failing the whole load.
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

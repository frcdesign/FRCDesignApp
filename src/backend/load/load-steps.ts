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

/**
 * Retries for a step waiting on an Onshape render: wait out a rate limit,
 * otherwise poll, since Onshape renders thumbnails asynchronously.
 */
export const THUMBNAIL_STEP_RETRIES = {
    limit: 3,
    delay: (retry: RetryDelayInput) =>
        rateLimitDelay(retry.error) ??
        (retry.ctx.attempt === 1 ? "10 seconds" : "5 minutes")
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

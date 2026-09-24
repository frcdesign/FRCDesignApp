import type { WorkflowBackoff } from "cloudflare:workers";
import { readRetryAfterSeconds } from "../../lib/onshape/client";
import { type ThumbnailUrls } from "../thumbnails/contract";
import type { LoadContext } from "./context";

/**
 * Workflows multiplies what `delay` returns by the backoff curve, which is
 * undocumented; exponential turned a 120s delay into hours.
 */
const CONSTANT_BACKOFF: WorkflowBackoff = "constant";

/** The retry input a Workflow `delay` callback receives. */
interface RetryDelayInput {
    ctx: { attempt: number };
    error: Error;
}

/**
 * Every step in a 429 burst gets the same `Retry-After`; without jitter they
 * all retry at once and trip it again.
 */
const RATE_LIMIT_JITTER_SECONDS = 20;

/**
 * Undefined when the error wasn't a rate limit. Reads the message because
 * Workflows rebuilds the error, so `instanceof` fails.
 */
export function rateLimitDelay(error: Error): `${number} seconds` | undefined {
    const retryAfterSeconds = readRetryAfterSeconds(error);
    if (retryAfterSeconds === undefined) {
        return undefined;
    }
    // Rounded: Workflows documents whole units, not fractional ones.
    const jitter = Math.round(Math.random() * RATE_LIMIT_JITTER_SECONDS);
    return `${retryAfterSeconds + jitter} seconds`;
}

/** Honors `Retry-After` on a 429; exponential otherwise. */
function onshapeRetryDelay(input: RetryDelayInput): `${number} seconds` {
    const rateLimited = rateLimitDelay(input.error);
    if (rateLimited) {
        return rateLimited;
    }
    const seconds = Math.min(10 * 2 ** (input.ctx.attempt - 1), 300);
    return `${seconds} seconds`;
}

/** For every step that calls Onshape, so a 429's `Retry-After` is honored. */
export const ONSHAPE_STEP_RETRIES = {
    limit: 5,
    delay: onshapeRetryDelay,
    backoff: CONSTANT_BACKOFF
};

/** A freshly restored workspace takes minutes to render: about 17 minutes in all. */
const THUMBNAIL_RETRIES = {
    limit: 10,
    delay: (input: RetryDelayInput): `${number} seconds` =>
        rateLimitDelay(input.error) ??
        `${Math.min(30 * input.ctx.attempt, 120)} seconds`,
    backoff: CONSTANT_BACKOFF
};

/**
 * `null` when Onshape never renders them, which becomes a build issue. The slot
 * is taken outside the step so waiting for it doesn't count against its timeout.
 */
export async function uploadThumbnailsStep(
    ctx: LoadContext,
    name: string,
    upload: () => Promise<ThumbnailUrls>
): Promise<ThumbnailUrls | null> {
    try {
        return await ctx.thumbnailLimit(() =>
            ctx.step.do(name, { retries: THUMBNAIL_RETRIES }, upload)
        );
    } catch {
        return null;
    }
}

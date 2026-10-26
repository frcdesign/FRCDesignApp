import type { WorkflowBackoff, WorkflowStep } from "cloudflare:workers";
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

/**
 * For every step that calls Onshape, but those waiting on its thumbnails: one
 * retry, soon, after a 429's `Retry-After`. Onshape answers these at once,
 * waiting on no background work, so one failing twice will keep failing.
 */
export const ONSHAPE_STEP_RETRIES = {
    limit: 1,
    delay: (input: RetryDelayInput): `${number} seconds` =>
        rateLimitDelay(input.error) ?? "2 seconds",
    backoff: CONSTANT_BACKOFF
};

/** Honors `Retry-After` on a 429; doubling from 10 s otherwise. */
function thumbnailRetryDelay(input: RetryDelayInput): `${number} seconds` {
    return (
        rateLimitDelay(input.error) ??
        `${10 * 2 ** (input.ctx.attempt - 1)} seconds`
    );
}

/**
 * Three retries, honoring a rate limit. An element's thumbnail is rendered on
 * save, so this only covers Onshape still writing one out just after it.
 */
const THUMBNAIL_RETRIES = {
    limit: 3,
    delay: thumbnailRetryDelay,
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

/**
 * The same steps under names of their own, so one reload can run a group's
 * steps for each of its groups. Step names identify a step's stored result.
 */
export function prefixSteps(step: WorkflowStep, prefix: string): WorkflowStep {
    return {
        do: (name: string, ...rest: unknown[]) =>
            (step.do as (name: string, ...rest: unknown[]) => unknown)(
                `${prefix}${name}`,
                ...rest
            ),
        sleep: (name, duration) => step.sleep(`${prefix}${name}`, duration),
        sleepUntil: (name, timestamp) =>
            step.sleepUntil(`${prefix}${name}`, timestamp),
        waitForEvent: (name, options) =>
            step.waitForEvent(`${prefix}${name}`, options)
    } as WorkflowStep;
}

import { OnshapeRateLimitError } from "../../lib/onshape/client";
import type { ThumbnailUrls } from "../thumbnails/contract";
import type { LoadContext } from "./context";

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
    delay: onshapeRetryDelay
};

/** The first wait after a render isn't ready; each attempt doubles it. */
const THUMBNAIL_BASE_DELAY_SECONDS = 4;

/**
 * Where the doubling stops. Left uncapped, the last waits grow longer than the
 * renders themselves, so a thumbnail that landed early sits unnoticed.
 */
const THUMBNAIL_MAX_DELAY_SECONDS = 120;

/**
 * Onshape gives no signal when a render lands, so the step polls, doubling from
 * four seconds. A rate limit overrides the curve.
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
    // 4s, 8s … 120s and then every two minutes: half an hour of polling, since
    // a reload is the only other way to pick a late render up.
    limit: 20,
    delay: thumbnailRetryDelay
};

/**
 * Where the doubling stops for a render someone is waiting on. The curve above
 * ends up waiting longer than the render takes — a thumbnail that lands a
 * second after a poll then sits unserved for two minutes, which is most of what
 * an insert preview spends spinning.
 */
const CONFIGURATION_MAX_DELAY_SECONDS = 15;

function configurationThumbnailRetryDelay(
    input: RetryDelayInput
): `${number} seconds` {
    const rateLimited = rateLimitDelay(input.error);
    if (rateLimited) {
        return rateLimited;
    }
    const seconds = Math.min(
        THUMBNAIL_BASE_DELAY_SECONDS * 2 ** (input.ctx.attempt - 1),
        CONFIGURATION_MAX_DELAY_SECONDS
    );
    return `${seconds} seconds`;
}

/**
 * The configuration render behind the insert preview, where a person is
 * watching a spinner rather than a load nobody is. Each attempt is one Onshape
 * call — see `uploadConfigurationThumbnails` — so this polls harder than
 * {@link THUMBNAIL_STEP_RETRIES} and still asks Onshape fewer times overall.
 */
export const CONFIGURATION_THUMBNAIL_RETRIES = {
    // 4s, 8s, then every 15s: about ten minutes, which outlasts the six the
    // client polls for.
    limit: 40,
    delay: configurationThumbnailRetryDelay
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

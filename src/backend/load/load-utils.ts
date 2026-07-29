import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiFromSessionId } from "../auth";
import {
    type OnshapeApi,
    OnshapeRateLimitError
} from "../onshape-api/onshape-api";
import type { ElementType, LibraryId, ThumbnailUrls } from "../../shared/types";
import type { ElementPath } from "../../shared/onshape-path";

export interface LoadContext {
    env: AppBindings;
    sessionId: string;
    step: WorkflowStep;
}

export function getOnshapeApi(ctx: LoadContext): Promise<OnshapeApi> {
    return getOnshapeApiFromSessionId(ctx.env.KV, ctx.sessionId);
}

/**
 * An insertable selected for (re)loading: where to read it from in Onshape,
 * which group it belongs to, and the flags carried over from its existing row.
 */
export interface InsertableToLoad {
    insertableId: string;
    libraryId: LibraryId;
    groupId: string;
    /** Version-pinned location of the element in Onshape. */
    path: ElementPath;
    name: string;
    elementType: ElementType;
    microversionId: string;
    sortOrder: number;
    supportsFasten: boolean;
    searchPartNumbers: boolean;
}

/** The retry input a Workflow `delay` callback receives. */
interface RetryDelayInput {
    ctx: { attempt: number };
    error: Error;
}

/**
 * Retry delay honoring Onshape's `Retry-After` on a 429 (waited out durably by
 * the workflow), with an exponential-ish fallback for other transient errors.
 * Shared by Onshape-calling steps. The return is a `${number} seconds` literal
 * so it satisfies the Workflow delay type.
 */
export function onshapeRetryDelay(input: RetryDelayInput): `${number} seconds` {
    if (input.error instanceof OnshapeRateLimitError) {
        return `${input.error.retryAfterSeconds} seconds`;
    }
    const seconds = Math.min(10 * 2 ** (input.ctx.attempt - 1), 300);
    return `${seconds} seconds`;
}

/** Retry config for a step that calls Onshape; honors `Retry-After` on 429. */
export const ONSHAPE_STEP_RETRIES = {
    limit: 8,
    delay: onshapeRetryDelay
};

/**
 * Uploads thumbnails in a single step with retrying.
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
                retries: {
                    limit: 3,
                    // Wait out a rate limit; otherwise poll for the thumbnail.
                    delay: (retry) =>
                        retry.error instanceof OnshapeRateLimitError
                            ? `${retry.error.retryAfterSeconds} seconds`
                            : retry.ctx.attempt === 1
                              ? "10 seconds"
                              : "5 minutes"
                }
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

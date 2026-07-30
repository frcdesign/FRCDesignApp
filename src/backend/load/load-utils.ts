import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiFromSessionId } from "../auth";
import {
    type OnshapeApi,
    OnshapeRateLimitError
} from "../onshape-api/onshape-api";
import type { ElementType, LibraryId, ThumbnailUrls } from "../../shared/types";
import type { ElementPath, InstancePath } from "../../shared/onshape-path";

/** The runtime plumbing a load runs against. */
export interface LoadContext {
    env: AppBindings;
    sessionId: string;
    step: WorkflowStep;
}

export function getOnshapeApiFromContext(
    ctx: LoadContext
): Promise<OnshapeApi> {
    return getOnshapeApiFromSessionId(ctx.env.KV, ctx.sessionId);
}

/** The group and document version a load reads from. */
export interface GroupTarget {
    libraryId: LibraryId;
    groupId: string;
    /** Version-pinned location of the group's document in Onshape. */
    versionPath: InstancePath;
}

/**
 * An insertable a load reads: where it lives in Onshape, the ids it is stored
 * under, and what the document's tab listing already told us about it.
 *
 * Deliberately carries none of the user-owned flags (`supportsFasten`,
 * `searchPartNumbers`, `isVisible`) — `loadInsertable` reads the ones it needs
 * itself, and the save never writes them for an existing row.
 */
export interface InsertableTarget {
    insertableId: string;
    libraryId: LibraryId;
    groupId: string;
    /** Version-pinned location of the element in Onshape. */
    elementPath: ElementPath;
    elementType: ElementType;
    name: string;
    microversionId: string;
    sortOrder: number;
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

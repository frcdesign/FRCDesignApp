import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import type { OnshapeApi } from "../onshape-api/onshape-api";
import type { ElementType, LibraryId, ThumbnailUrls } from "../../shared/types";

export interface LoadContext {
    env: AppBindings;
    sessionId: string;
    step: WorkflowStep;
}

/**
 * The group-scoped fields every element in a load shares — resolved by
 * loadGroup's diff step and passed down in memory, never read back from a
 * half-written group row.
 */
export interface GroupFields {
    libraryId: LibraryId;
    groupId: string;
    documentId: string;
    versionId: string;
}

export interface GroupContext extends LoadContext, GroupFields {}

/**
 * One element to load, with its identity already resolved by loadGroup's diff
 * step: the row's id (freshly minted for a new element, inside the memoized
 * step so it's replay-stable) and the stored fields the load consults.
 */
export interface InsertableElement {
    insertableId: string;
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
    sortOrder: number;
    supportsFasten: boolean;
}

export function api(ctx: LoadContext): Promise<OnshapeApi> {
    return getOnshapeApiForSessionId(ctx.env.KV, ctx.sessionId);
}

/**
 * Uploads thumbnails in a single step whose retry schedule is tuned to
 * Onshape's lazy rendering: a still-missing thumbnail throws to trigger a
 * quick second attempt, then spaced ones. Exhaustion resolves to null (a
 * build issue on the row); it never fails the caller. Shared by the group and
 * per-element thumbnail uploads.
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
                    delay: (retry) =>
                        retry.ctx.attempt === 1 ? "5 seconds" : "5 minutes"
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

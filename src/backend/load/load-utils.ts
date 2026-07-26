import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiFromSessionId } from "../auth";
import type { OnshapeApi } from "../onshape-api/onshape-api";
import type { ElementType, LibraryId, ThumbnailUrls } from "../../shared/types";

export interface LoadContext {
    env: AppBindings;
    sessionId: string;
    step: WorkflowStep;
}

export function getOnshapeApiFromLoadContext(
    ctx: LoadContext
): Promise<OnshapeApi> {
    return getOnshapeApiFromSessionId(ctx.env.KV, ctx.sessionId);
}

/**
 * Group-specific information copied to an Insertable.
 */
export interface InsertableGroupFields {
    libraryId: LibraryId;
    groupId: string;
    documentId: string;
    versionId: string;
}

/**
 * Insertable-specific information which is parsed from Onshape.
 */
export interface InsertableElement {
    insertableId: string;
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
    sortOrder: number;
    supportsFasten: boolean;
    searchPartNumbers: boolean;
}

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
                    delay: (retry) =>
                        retry.ctx.attempt === 1 ? "10 seconds" : "5 minutes"
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

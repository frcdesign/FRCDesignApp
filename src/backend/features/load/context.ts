import type { WorkflowStep } from "cloudflare:workers";
import { createLimiter, type Limiter } from "../../lib/limiter";
import type { AppBindings } from "../../lib/context";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import type { OAuthApi } from "../../lib/onshape/client";
import type { ElementType } from "../../lib/onshape/element-type";
import type { LibraryId } from "../library/library-id";
import type { ElementPath, InstancePath } from "../../lib/onshape/path";

/**
 * Bounded by Onshape's rate limit: at 40 a load hit 429s it never recovered
 * from. 15 is what worked before, not a measured limit.
 */
export const LOAD_CONCURRENCY = 15;

/** Separate from probing, since a thumbnail step holds its slot through minutes of retries. */
const THUMBNAIL_CONCURRENCY = 10;

/** The runtime plumbing a load runs against. */
export interface LoadContext {
    env: AppBindings;
    sessionId: string;
    step: WorkflowStep;
    /** Bounds concurrent Onshape probing across the whole run. */
    limit: Limiter;
    thumbnailLimit: Limiter;
}

export function createLoadContext(
    env: AppBindings,
    sessionId: string,
    step: WorkflowStep
): LoadContext {
    return {
        env,
        sessionId,
        step,
        limit: createLimiter(LOAD_CONCURRENCY),
        thumbnailLimit: createLimiter(THUMBNAIL_CONCURRENCY)
    };
}

export function getOnshapeApiFromContext(ctx: LoadContext): Promise<OAuthApi> {
    return getOnshapeApiFromSessionId(ctx.env.KV, ctx.sessionId);
}

/** A group a load reads, and what the document told us about it. */
export interface GroupTarget {
    libraryId: LibraryId;
    groupId: string;
    versionPath: InstancePath;
    /** When Onshape cut `versionPath`'s version. */
    versionCreatedAt: Date;
    name: string;
    /** The tab the document renders its thumbnail from, when one is set. */
    thumbnailElementId?: string;
}

/** Only a group that loads gets a thumbnail workspace; see `loadGroup`. */
export interface LoadingGroup extends GroupTarget {
    /** See `thumbnails/workspace.ts`. */
    thumbnailPath: InstancePath;
}

/** An insertable a load reads, and what the document's tab listing told us. */
export interface InsertableTarget {
    insertableId: string;
    thumbnailPath: ElementPath;
    libraryId: LibraryId;
    groupId: string;
    elementPath: ElementPath;
    /** When Onshape cut `elementPath`'s version. */
    versionCreatedAt: Date;
    elementType: ElementType;
    name: string;
    microversionId: string;
    sortOrder: number;
}

import type { WorkflowStep } from "cloudflare:workers";
import { createLimiter, type Limiter } from "../../lib/limiter";
import type { AppBindings } from "../../lib/context";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import type { OnshapeApi } from "../../lib/onshape/client";
import type { ElementType } from "../../lib/onshape/element-type";
import type { LibraryId } from "../library/library-id";
import type { ElementPath, InstancePath } from "../../lib/onshape/path";

/**
 * How many insertables a load probes Onshape for at once — see
 * `probeInsertable`, which is the part of a load that asks Onshape anything
 * beyond a thumbnail. What bounds this is Onshape's rate limit rather than
 * anything here: past it the extra calls come back 429 and wait out their
 * `Retry-After` (see `ONSHAPE_STEP_RETRIES`), and a step whose five attempts run
 * out fails its insertable.
 *
 * Back to 15 after 40 drove a load into a rate limit it never climbed out of:
 * six attempts on one step, all 429, across five minutes. Still not measured
 * against where Onshape actually starts pushing back, so this is the number that
 * was working before rather than a considered one.
 */
export const LOAD_CONCURRENCY = 15;

/**
 * How many thumbnails a load waits on at once. A separate limiter from
 * probing's, because a thumbnail step holds its slot through minutes of
 * retries, and on the probing limiter that would stall probes behind it.
 */
export const THUMBNAIL_CONCURRENCY = 10;

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

export function getOnshapeApiFromContext(
    ctx: LoadContext
): Promise<OnshapeApi> {
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

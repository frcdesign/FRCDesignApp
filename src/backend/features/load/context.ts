import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import {
    getOnshapeApiFromSessionId,
    getUserIdFromSessionId
} from "../auth/request-auth";
import type { Renderer } from "../thumbnails/renderer";
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
 * out fails its insertable. Raised from 15 without measuring where Onshape
 * actually starts pushing back.
 */
export const LOAD_CONCURRENCY = 40;

/** Runs a task, waiting for a slot when the limiter is full. */
type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Runs at most `max` tasks at once, queueing the rest in call order, so a
 * rate-limit burst only hits the running few.
 */
export function createLimiter(max: number): Limiter {
    let active = 0;
    const queue: (() => void)[] = [];

    const release = () => {
        active--;
        const next = queue.shift();
        if (next) next();
    };

    return async <T>(task: () => Promise<T>): Promise<T> => {
        if (active >= max) {
            await new Promise<void>((resolve) => queue.push(resolve));
        }
        active++;
        try {
            return await task();
        } finally {
            release();
        }
    };
}

/** The runtime plumbing a load runs against. */
export interface LoadContext {
    env: AppBindings;
    sessionId: string;
    step: WorkflowStep;
    /** Bounds concurrent Onshape probing across the whole run. */
    limit: Limiter;
    /** The queue this load's thumbnails join; lazy, since resolving it reads KV. */
    renderer: () => Promise<Renderer>;
}

export function createLoadContext(
    env: AppBindings,
    sessionId: string,
    step: WorkflowStep
): LoadContext {
    // Kept across the run, but only when it worked: caching the rejection
    // would fail every thumbnail after one bad read.
    let resolved: Promise<Renderer> | undefined;
    const renderer = () =>
        (resolved ??= resolveRenderer(env, sessionId).catch((error) => {
            resolved = undefined;
            throw error;
        }));

    return {
        env,
        sessionId,
        step,
        limit: createLimiter(LOAD_CONCURRENCY),
        renderer
    };
}

async function resolveRenderer(
    env: AppBindings,
    sessionId: string
): Promise<Renderer> {
    return {
        userId: await getUserIdFromSessionId(env.KV, sessionId),
        sessionId
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
    /**
     * The document's default workspace. Everything the library shows is pinned
     * to the version; this is only where thumbnails are read from, because the
     * version form of that endpoint does not reliably return them.
     */
    workspacePath: InstancePath;
    name: string;
    /** The tab the document renders its thumbnail from, when one is set. */
    thumbnailElementId?: string;
}

/** An insertable a load reads, and what the document's tab listing told us. */
export interface InsertableTarget {
    insertableId: string;
    /**
     * The same tab in the document's workspace, which the thumbnail falls back
     * to when the version does not answer. Absent when the tab has left the
     * workspace, leaving the version as the only place to ask.
     */
    workspacePath?: ElementPath;
    libraryId: LibraryId;
    groupId: string;
    elementPath: ElementPath;
    elementType: ElementType;
    name: string;
    microversionId: string;
    sortOrder: number;
}

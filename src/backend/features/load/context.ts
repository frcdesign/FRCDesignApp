import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../../lib/context";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import type { OnshapeApi } from "../../lib/onshape/client";
import type { ElementType } from "../../lib/onshape/element-type";
import type { LibraryId } from "../library/library-id";
import type { ElementPath, InstancePath } from "../../lib/onshape/path";

/** How many insertables a load reads from Onshape at once. */
export const LOAD_CONCURRENCY = 15;

/** Runs a task, waiting for a slot when the limiter is full. */
export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

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
    /** Bounds concurrent insertable loads across the whole run. */
    limit: Limiter;
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
    name: string;
    /** The tab the document renders its thumbnail from, when one is set. */
    thumbnailElementId?: string;
}

/** An insertable a load reads, and what the document's tab listing told us. */
export interface InsertableTarget {
    insertableId: string;
    libraryId: LibraryId;
    groupId: string;
    elementPath: ElementPath;
    elementType: ElementType;
    name: string;
    microversionId: string;
    sortOrder: number;
}

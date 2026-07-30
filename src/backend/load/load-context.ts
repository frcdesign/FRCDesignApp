import type { WorkflowStep } from "cloudflare:workers";
import type { AppBindings } from "../app";
import { getOnshapeApiFromSessionId } from "../auth";
import type { OnshapeApi } from "../onshape-api/onshape-api";
import type { ElementType, LibraryId } from "../../shared/types";
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

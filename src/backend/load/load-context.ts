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

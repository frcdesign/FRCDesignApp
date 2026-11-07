/** The parents a workspace could be linked to: the documents it already references. */
import type { Db } from "../../db/client";
import type { AppContext } from "../../lib/context";
import type { OnshapeApi } from "../../lib/onshape/client";
import { getExternalReferences } from "../../lib/onshape/endpoints/documents";
import type { OnshapeExternalReferences } from "../../lib/onshape/types";
import { createLimiter } from "../../lib/limiter";
import {
    MAX_SUGGESTED_LINKS,
    type SuggestedLink,
    type WorkspacePath
} from "./contract";
import { getLinkedDocumentIds } from "./links";
import {
    canRead,
    describeWorkspace,
    findDefaultWorkspace
} from "./workspace-cache";

/** Each suggestion costs a few Onshape reads on a cold cache. */
const SUGGESTION_CONCURRENCY = 5;

/** Every document the workspace's tabs reference, once each, in the order Onshape lists them. */
export function referencedDocumentIds(
    externalReferences: OnshapeExternalReferences,
    ownDocumentId: string
): string[] {
    const ids = new Set<string>();
    for (const references of Object.values(
        externalReferences.elementExternalReferences ?? {}
    )) {
        for (const reference of references) {
            ids.add(reference.documentId);
        }
    }
    ids.delete(ownDocumentId);
    return [...ids];
}

/**
 * The documents `workspace` references that are linked to it neither way,
 * each at its default workspace, the one a version of it is normally cut
 * from. A document the caller cannot read is left out entirely.
 */
export async function suggestParents(
    c: AppContext,
    db: Db,
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<SuggestedLink[]> {
    const [externalReferences, linked] = await Promise.all([
        getExternalReferences(client, workspace),
        getLinkedDocumentIds(db, workspace)
    ]);
    const documentIds = referencedDocumentIds(
        externalReferences,
        workspace.documentId
    )
        .filter((id) => !linked.has(id))
        .slice(0, MAX_SUGGESTED_LINKS);

    const limit = createLimiter(SUGGESTION_CONCURRENCY);
    const suggestions = await Promise.all(
        documentIds.map((documentId) =>
            limit(() => suggest(c, client, documentId))
        )
    );
    return suggestions
        .filter((each) => each !== undefined)
        .sort((a, b) =>
            (a.documentName ?? "").localeCompare(b.documentName ?? "")
        );
}

/** One referenced document as a suggestion, or undefined where it can't be one. */
async function suggest(
    c: AppContext,
    client: OnshapeApi,
    documentId: string
): Promise<SuggestedLink | undefined> {
    try {
        if (!(await canRead(c, client, { documentId }))) {
            return undefined;
        }
        const workspace = await findDefaultWorkspace(c, client, {
            documentId
        });
        if (!workspace) {
            return undefined;
        }
        return {
            workspace,
            ...(await describeWorkspace(c, client, workspace))
        };
    } catch (error) {
        // Deleted, or unshared since the reference was made: not a suggestion.
        console.warn(`Failed to suggest ${documentId}`, error);
        return undefined;
    }
}

/**
 * Moving a workspace's external references onto newer versions — the one
 * operation both push and pull are made of.
 */
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getExternalReferences,
    updateReferences,
    type ReferenceUpdate
} from "../../lib/onshape/endpoints/documents";
import type { ElementPath } from "../../lib/onshape/path";
import type { OnshapeExternalReferences } from "../../lib/onshape/types";
import type { WorkspacePath } from "./contract";

export interface ReferenceUpdateOptions {
    /**
     * Only move references into these documents. Omitted, every out-of-date
     * reference is fair game, which is what a plain pull asks for.
     */
    onlyDocumentIds?: string[];
    /**
     * The version to move a document's references to, overriding the newest one
     * Onshape reports. A push sets this for the versions it has just cut.
     */
    pinnedVersions?: Record<string, string>;
}

/** The updates one tab needs, ready to post. */
export interface ElementUpdatePlan {
    elementPath: ElementPath;
    updates: ReferenceUpdate[];
}

export interface ReferenceUpdateCounts {
    updatedElements: number;
    /** Tabs Onshape refused; the run goes on past them. */
    failedElements: number;
}

/**
 * Which references to move where. Pure: the decisions live here so they can be
 * tested, and {@link updateOutdatedReferences} is left doing only the calls.
 */
export function planReferenceUpdates(
    workspace: WorkspacePath,
    externalReferences: OnshapeExternalReferences,
    options: ReferenceUpdateOptions = {}
): ElementUpdatePlan[] {
    const { onlyDocumentIds, pinnedVersions } = options;
    const wanted = onlyDocumentIds ? new Set(onlyDocumentIds) : undefined;

    const latestVersions = new Map(
        (externalReferences.latestVersions ?? []).map((version) => [
            version.documentId,
            version.id
        ])
    );

    const plans: ElementUpdatePlan[] = [];
    for (const [elementId, references] of Object.entries(
        externalReferences.elementExternalReferences ?? {}
    )) {
        const updates: ReferenceUpdate[] = [];
        for (const reference of references) {
            const { documentId } = reference;
            if (wanted && !wanted.has(documentId)) continue;

            const pinned = pinnedVersions?.[documentId];
            // Onshape's own verdict decides only when we have no version of our
            // own in mind. A push cut one moments ago, and whether that has
            // reached this flag yet is not something to depend on.
            if (!pinned && !reference.isOutOfDate) continue;

            const versionId = pinned ?? latestVersions.get(documentId);
            if (!versionId || versionId === reference.id) continue;

            for (const referencedElement of reference.referencedElements) {
                updates.push({
                    // References are always to versions, which is why both ends
                    // are spelled `v` rather than carried from the caller.
                    fromReference: {
                        documentId,
                        instanceId: reference.id,
                        instanceType: "v",
                        elementId: referencedElement
                    },
                    toReference: {
                        documentId,
                        instanceId: versionId,
                        instanceType: "v",
                        elementId: referencedElement
                    }
                });
            }
        }
        if (updates.length > 0) {
            plans.push({
                elementPath: { ...workspace, elementId },
                updates
            });
        }
    }
    return plans;
}

/**
 * Repoints every reference in `workspace` that {@link planReferenceUpdates}
 * picks out.
 *
 * One tab at a time, as the implementation this came from had it — its comment
 * says running them concurrently caused problems, and does not say what. A tab
 * Onshape rejects is counted and stepped over rather than abandoning the rest,
 * which that implementation also did, except that it reported the run a success
 * either way.
 */
export async function updateOutdatedReferences(
    client: OnshapeApi,
    workspace: WorkspacePath,
    options: ReferenceUpdateOptions = {}
): Promise<ReferenceUpdateCounts> {
    const externalReferences = await getExternalReferences(client, workspace);
    const plans = planReferenceUpdates(workspace, externalReferences, options);

    let updatedElements = 0;
    let failedElements = 0;
    for (const plan of plans) {
        try {
            await updateReferences(client, plan.elementPath, plan.updates);
            updatedElements++;
        } catch (error) {
            console.warn(
                `Failed to update references in ${plan.elementPath.elementId}`,
                error
            );
            failedElements++;
        }
    }
    return { updatedElements, failedElements };
}

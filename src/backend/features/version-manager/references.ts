/**
 * Moving a workspace's external references onto newer versions — the one
 * operation both push and pull are made of.
 */
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    getContents,
    getDocument,
    getExternalReferences,
    updateReferences,
    type ReferenceUpdate
} from "../../lib/onshape/endpoints/documents";
import type { ElementPath } from "../../lib/onshape/path";
import type { OnshapeExternalReferences } from "../../lib/onshape/types";
import type { VersionJobFailure, WorkspacePath } from "./contract";
import { describeTabFailure, isTransient } from "./failures";

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

export interface ReferenceUpdateOutcome {
    updatedElements: number;
    /** Tabs Onshape refused; the run goes on past them. */
    failures: VersionJobFailure[];
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
 * says running them concurrently caused problems, and does not say what.
 *
 * A tab Onshape refuses is recorded and stepped over rather than abandoning the
 * rest. A transient failure is thrown instead, so the step retries: the retry
 * plans afresh, and a tab the first attempt moved is already on its version and
 * is skipped — which also leaves it out of the retry's count.
 */
export async function updateOutdatedReferences(
    client: OnshapeApi,
    workspace: WorkspacePath,
    options: ReferenceUpdateOptions = {}
): Promise<ReferenceUpdateOutcome> {
    const externalReferences = await getExternalReferences(client, workspace);
    const plans = planReferenceUpdates(workspace, externalReferences, options);

    let updatedElements = 0;
    const refused: { elementId: string; reason: string }[] = [];
    for (const plan of plans) {
        try {
            await updateReferences(client, plan.elementPath, plan.updates);
            updatedElements++;
        } catch (error) {
            if (isTransient(error)) {
                throw error;
            }
            console.warn(
                `Onshape refused to update references in ${plan.elementPath.elementId}`,
                error
            );
            refused.push({
                elementId: plan.elementPath.elementId,
                reason: describeTabFailure(error)
            });
        }
    }
    return {
        updatedElements,
        failures: await nameFailures(client, workspace, refused)
    };
}

/**
 * The refused tabs with their document's and their own names, asked for only
 * when there is something to report. Best effort: a report that shows ids is
 * still a report, where one that failed to be written is not.
 */
async function nameFailures(
    client: OnshapeApi,
    workspace: WorkspacePath,
    refused: { elementId: string; reason: string }[]
): Promise<VersionJobFailure[]> {
    if (refused.length === 0) {
        return [];
    }
    const [document, contents] = await Promise.all([
        getDocument(client, workspace).catch(() => undefined),
        getContents(client, workspace).catch(() => undefined)
    ]);
    const tabNames = new Map(
        (contents?.elements ?? []).map((element) => [element.id, element.name])
    );
    return refused.map((each) => ({
        workspace,
        documentName: document?.name,
        elementId: each.elementId,
        elementName: tabNames.get(each.elementId),
        reason: each.reason
    }));
}

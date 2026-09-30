import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { AppBindings } from "../../lib/context";
import type { OnshapeApi } from "../../lib/onshape/client";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import {
    createVersion,
    getVersions
} from "../../lib/onshape/endpoints/versions";
import { getWorkspaces } from "../../lib/onshape/endpoints/workspaces";
import type { OnshapeVersionInfo } from "../../lib/onshape/types";
import { ONSHAPE_STEP_RETRIES } from "../load/steps";
import {
    emptyJobResult,
    MAX_REPORTED_FAILURES,
    nextVersionName,
    VersionJobKind,
    VersionJobState,
    type PullScopeKind,
    type PushScopeKind,
    type VersionJobResult,
    type WorkspacePath
} from "./contract";
import {
    updateOutdatedReferences,
    type ReferenceUpdateOutcome
} from "./references";
import { describeRunFailure, isTransient } from "./failures";
import { finishJob } from "./jobs";
import { trackVersionRun } from "../analytics/tracking";
import { VersionRunKind } from "../analytics/usage";

/**
 * Retries a step only when trying again could go differently: a refusal would
 * fail the same way five more times, minutes apart, before the run could say so.
 */
function failFast<T>(callback: () => Promise<T>): () => Promise<T> {
    return async () => {
        try {
            return await callback();
        } catch (error) {
            if (isTransient(error)) {
                throw error;
            }
            throw new NonRetryableError(
                error instanceof Error ? error.message : String(error)
            );
        }
    };
}

/** The version a run moves references onto, and whether it had to cut it. */
interface VersionChoice {
    version: OnshapeVersionInfo;
    reused: boolean;
}

/** One workspace a push updates, and whether the run versions it afterwards. */
export interface PushStep {
    workspace: WorkspacePath;
    /**
     * Set only by a recursive push, and only because the workspaces past this
     * one have no other way to pick the change up: a reference can point at a
     * version, so there has to be one.
     */
    createVersion: boolean;
}

interface JobParamsBase {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    /** Who started it, for the record the run writes when it finishes. */
    userId: string;
    /** The workspace the run was started from, which its status is keyed by. */
    workspace: WorkspacePath;
    /** How it was aimed, which only the record it writes reads back. */
    scope: PushScopeKind | PullScopeKind;
}

export interface PushJobParams extends JobParamsBase {
    kind: "push";
    /**
     * Absent for a quick push, where each document is versioned as Onshape's
     * own dialog would name it: see {@link nextVersionName}. A name given here
     * is used for every version the run cuts.
     */
    name?: string;
    description: string;
    /** In the order they have to run; see `pushOrder`. */
    steps: PushStep[];
}

export interface PullJobParams extends JobParamsBase {
    kind: "pull";
    /**
     * The parents to pull from: each is versioned, and this workspace's
     * references are moved onto that version. Absent means every out-of-date
     * reference instead — what the old app called "update all references" —
     * which versions nothing, the documents behind those references being
     * nobody's to cut a version in.
     */
    sources?: WorkspacePath[];
    /** Absent for a quick pull; the run then names each version as Onshape would. */
    name?: string;
    description: string;
}

export type VersionJobParams = PushJobParams | PullJobParams;

/**
 * Runs a push or a pull.
 *
 * In a workflow rather than on the request because both are a chain of Onshape
 * writes: a rate limit partway through a push would otherwise leave a version
 * cut and half the references moved, with nothing to resume from. Every Onshape
 * step takes {@link ONSHAPE_STEP_RETRIES}, which honors Onshape's `Retry-After`.
 *
 * What may be done was settled before the run started — the route checks
 * permissions across every workspace in `steps`, so a push cannot cut its first
 * version only to find it may not finish.
 */
export class VersionManagerWorkflow extends WorkflowEntrypoint<
    AppBindings,
    VersionJobParams
> {
    async run(
        event: WorkflowEvent<VersionJobParams>,
        step: WorkflowStep
    ): Promise<VersionJobResult> {
        const params = event.payload;
        const jobId = event.instanceId;
        const kind =
            params.kind === "push" ? VersionJobKind.PUSH : VersionJobKind.PULL;
        // Added to as the steps come back, which a replay does again from their
        // saved results: a run that stops can then say what it had done.
        const result = emptyJobResult();

        // Recorded whichever way it ends: a run that stopped partway still did
        // what it did.
        const recordRun = () =>
            step.do("record-run", () =>
                trackVersionRun(this.env, {
                    userId: params.userId,
                    kind:
                        kind === VersionJobKind.PUSH
                            ? VersionRunKind.PUSH
                            : VersionRunKind.PULL,
                    scope: params.scope,
                    result
                })
            );

        try {
            if (params.kind === "push") {
                await this._push(params, step, result);
            } else {
                await this._pull(params, step, result);
            }
        } catch (error) {
            await step.do("finish-job", () =>
                finishJob(this.env, params.workspace, {
                    state: VersionJobState.FAILED,
                    jobId,
                    kind,
                    result,
                    error: describeRunFailure(error),
                    finishedAt: Date.now()
                })
            );
            await recordRun();
            throw error;
        }

        await step.do("finish-job", () =>
            finishJob(this.env, params.workspace, {
                state: VersionJobState.COMPLETE,
                jobId,
                kind,
                result,
                finishedAt: Date.now()
            })
        );
        await recordRun();
        return result;
    }

    /**
     * The version to move references onto: the one the workspace is already at
     * when nothing has changed since it was cut, and otherwise a new one, under
     * the name given or the one Onshape's own dialog would offer.
     *
     * A version records the microversion it was cut at, and every edit moves a
     * workspace's microversion on, so a match is exact — and holds for a
     * document with several workspaces, where the newest version may be another
     * workspace's. It also makes a retried step safe: a version the first
     * attempt cut is found, not cut twice.
     */
    private async _versionFor(
        client: OnshapeApi,
        target: WorkspacePath,
        name: string | undefined,
        description: string
    ): Promise<VersionChoice> {
        const [workspaces, versions] = await Promise.all([
            getWorkspaces(client, target),
            getVersions(client, target)
        ]);
        const current = workspaces.find(
            (each) => each.id === target.instanceId
        )?.microversion;
        const unchanged =
            current === undefined
                ? undefined
                : versions.findLast(
                      (version) => version.microversion === current
                  );
        if (unchanged) {
            return { version: unchanged, reused: true };
        }
        // Numbered per document, so a run that versions several numbers each
        // from its own history rather than carrying the first one's number.
        const versionName =
            name ?? nextVersionName(versions.map((version) => version.name));
        const version = await createVersion(
            client,
            target,
            versionName,
            description
        );
        return { version, reused: false };
    }

    /** Folds one workspace's reference updates into the run's result. */
    private _addOutcome(
        result: VersionJobResult,
        outcome: ReferenceUpdateOutcome
    ): void {
        result.updatedElements += outcome.updatedElements;
        if (outcome.updatedElements > 0) {
            result.updatedWorkspaces++;
        }
        result.failedElements += outcome.failures.length;
        result.failures.push(
            ...outcome.failures.slice(
                0,
                MAX_REPORTED_FAILURES - result.failures.length
            )
        );
    }

    private _addVersion(result: VersionJobResult, choice: VersionChoice): void {
        if (choice.reused) {
            result.reusedVersions++;
        } else {
            result.createdVersions++;
        }
    }

    /**
     * A pull moves this workspace onto a version of each parent: the one the
     * parent is at if nothing has changed since, and otherwise a new one — a
     * reference points at a version, so a parent's unversioned edits are only
     * pullable once there is one holding them.
     */
    private async _pull(
        params: PullJobParams,
        step: WorkflowStep,
        result: VersionJobResult
    ): Promise<void> {
        const client = await getOnshapeApiFromSessionId(
            this.env.KV,
            params.sessionId
        );
        const { sources, name, description } = params;

        // Keyed by document, which the route has already made unambiguous by
        // refusing a run naming one twice.
        const pinnedVersions: Record<string, string> = {};
        for (const [index, source] of (sources ?? []).entries()) {
            const choice = await step.do(
                `parent-version-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                failFast(
                    (): Promise<VersionChoice> =>
                        this._versionFor(client, source, name, description)
                )
            );
            pinnedVersions[source.documentId] = choice.version.id;
            this._addVersion(result, choice);
        }

        const outcome = await step.do(
            "references",
            { retries: ONSHAPE_STEP_RETRIES },
            failFast(
                (): Promise<ReferenceUpdateOutcome> =>
                    updateOutdatedReferences(
                        client,
                        params.workspace,
                        // Every out-of-date reference where nothing was versioned,
                        // and otherwise the versions this run has settled on.
                        sources
                            ? {
                                  onlyDocumentIds: Object.keys(pinnedVersions),
                                  pinnedVersions
                              }
                            : {}
                    )
            )
        );
        this._addOutcome(result, outcome);
    }

    private async _push(
        params: PushJobParams,
        step: WorkflowStep,
        result: VersionJobResult
    ): Promise<void> {
        const client = await getOnshapeApiFromSessionId(
            this.env.KV,
            params.sessionId
        );
        const { workspace, name, description } = params;

        const versionFor = (target: WorkspacePath) =>
            this._versionFor(client, target, name, description);

        const root = await step.do(
            "version",
            { retries: ONSHAPE_STEP_RETRIES },
            failFast((): Promise<VersionChoice> => versionFor(workspace))
        );
        this._addVersion(result, root);

        // Every version this run has settled on, which is what the workspaces
        // further down are moved onto. Keyed by document, which the route has
        // already made unambiguous by refusing a run that versions one twice.
        const pinnedVersions: Record<string, string> = {
            [workspace.documentId]: root.version.id
        };

        for (const [index, pushStep] of params.steps.entries()) {
            const outcome = await step.do(
                `references-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                failFast(
                    (): Promise<ReferenceUpdateOutcome> =>
                        updateOutdatedReferences(client, pushStep.workspace, {
                            onlyDocumentIds: Object.keys(pinnedVersions),
                            pinnedVersions
                        })
                )
            );
            this._addOutcome(result, outcome);

            if (!pushStep.createVersion) continue;

            // Updating its references moved it on, so a workspace this updated
            // is versioned afresh; one that needed nothing may reuse its own.
            const choice = await step.do(
                `version-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                failFast(
                    (): Promise<VersionChoice> => versionFor(pushStep.workspace)
                )
            );
            pinnedVersions[pushStep.workspace.documentId] = choice.version.id;
            this._addVersion(result, choice);
        }
    }
}

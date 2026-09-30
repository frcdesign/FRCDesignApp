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
import { ONSHAPE_STEP_RETRIES } from "../load/steps";
import {
    emptyJobResult,
    nextVersionName,
    VersionJobKind,
    VersionJobState,
    VersionTaskState,
    type PullScopeKind,
    type PushScopeKind,
    type VersionJobDocument,
    type VersionJobResult,
    type VersionJobStatus,
    type VersionTask,
    type WorkspacePath
} from "./contract";
import {
    updateOutdatedReferences,
    type ReferenceUpdateOutcome,
    type ReferenceUpdateOptions
} from "./references";
import {
    describeRunFailure,
    describeStepFailure,
    isTransient
} from "./failures";
import { reportJob } from "./jobs";
import { planTasks } from "./tasks";
import { trackVersionRun } from "../analytics/tracking";
import { VersionRunKind } from "../analytics/usage";

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
    /**
     * Moves references onto the versions that already exist, cutting none: a
     * push leaves this workspace unversioned, and a pull its parents.
     */
    updateOnly: boolean;
    /** What the run was aimed at, which its status shows while it goes. */
    targets: VersionJobDocument[];
    /** Every document the run touches, by `workspaceKey`, as the route found them named. */
    documentNames: Record<string, string>;
    /**
     * Absent for a quick run, where each document is versioned as Onshape's
     * own dialog would name it: see {@link nextVersionName}. A name given here
     * is used for every version the run cuts.
     */
    name?: string;
    description: string;
}

export interface PushJobParams extends JobParamsBase {
    kind: "push";
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
}

export type VersionJobParams = PushJobParams | PullJobParams;

/** What one run is doing, shared by the steps that report on it. */
interface RunContext {
    params: VersionJobParams;
    step: WorkflowStep;
    client: OnshapeApi;
    jobId: string;
    kind: VersionJobKind;
    tasks: VersionTask[];
    result: VersionJobResult;
}

/**
 * Runs a push or a pull.
 *
 * In a workflow rather than on the request because both are a chain of Onshape
 * writes: a rate limit partway through a push would otherwise leave a version
 * cut and half the references moved, with nothing to resume from. Every Onshape
 * step takes {@link ONSHAPE_STEP_RETRIES}, which honors Onshape's `Retry-After`.
 *
 * A document that fails is recorded and passed: the run goes on to every other
 * document it can still reach, skipping only what needed the one that failed.
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
        const kind =
            params.kind === "push" ? VersionJobKind.PUSH : VersionJobKind.PULL;
        // Both moved on as the steps come back, which a replay does again from
        // their saved results: a run that stops can then say what it had done.
        const result = emptyJobResult();
        const tasks = planTasks(params);
        const status = (state: VersionJobState): VersionJobStatus => ({
            state,
            jobId: event.instanceId,
            kind,
            updateOnly: params.updateOnly,
            targets: params.targets,
            tasks,
            result
        });

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
            const client = await getOnshapeApiFromSessionId(
                this.env.KV,
                params.sessionId
            );
            const ctx: RunContext = {
                params,
                step,
                client,
                jobId: event.instanceId,
                kind,
                tasks,
                result
            };
            if (params.kind === "push") {
                await this._push(ctx, params);
            } else {
                await this._pull(ctx, params);
            }
        } catch (error) {
            await step.do("finish-job", () =>
                reportJob(this.env, params.workspace, {
                    ...status(VersionJobState.FAILED),
                    error: describeRunFailure(error),
                    finishedAt: Date.now()
                })
            );
            await recordRun();
            throw error;
        }

        await step.do("finish-job", () =>
            reportJob(this.env, params.workspace, {
                ...status(VersionJobState.COMPLETE),
                finishedAt: Date.now()
            })
        );
        await recordRun();
        return result;
    }

    /**
     * Runs one task: reports it started, then does it in a step that retries
     * only what could go differently. Any other failure leaves the step at once
     * in our own words — it would fail the same way five more times, minutes
     * apart — and is recorded against the task, which is where the run goes on
     * from. Undefined when the task failed.
     */
    private async _task<T extends Rpc.Serializable<T>>(
        ctx: RunContext,
        index: number,
        callback: () => Promise<T>
    ): Promise<T | undefined> {
        const task = ctx.tasks[index];
        task.state = VersionTaskState.RUNNING;
        await ctx.step.do(`report-${index}`, () =>
            reportJob(this.env, ctx.params.workspace, {
                state: VersionJobState.RUNNING,
                jobId: ctx.jobId,
                kind: ctx.kind,
                updateOnly: ctx.params.updateOnly,
                targets: ctx.params.targets,
                tasks: ctx.tasks,
                result: ctx.result
            })
        );
        try {
            const value = await ctx.step.do(
                `task-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () => {
                    try {
                        return await callback();
                    } catch (error) {
                        if (isTransient(error)) {
                            throw error;
                        }
                        throw new NonRetryableError(
                            describeStepFailure(error, task.action)
                        );
                    }
                }
            );
            task.state = VersionTaskState.DONE;
            return value;
        } catch (error) {
            task.state = VersionTaskState.FAILED;
            task.reason = describeRunFailure(error);
            return undefined;
        }
    }

    /** Marks a task that will not be tried, and says it was not. */
    private _skip(ctx: RunContext, index: number): void {
        ctx.tasks[index].state = VersionTaskState.SKIPPED;
    }

    /**
     * A new version of the workspace, under the name given or the one
     * Onshape's own dialog would offer. Numbered per document, so a run that
     * versions several numbers each from its own history.
     */
    private async _version(
        ctx: RunContext,
        index: number,
        target: WorkspacePath
    ): Promise<string | undefined> {
        const { client, params } = ctx;
        const versionId = await this._task(ctx, index, async () => {
            const versions = await getVersions(client, target);
            const version = await createVersion(
                client,
                target,
                params.name ??
                    nextVersionName(versions.map((each) => each.name)),
                params.description
            );
            return version.id;
        });
        if (versionId !== undefined) {
            ctx.result.createdVersions++;
        }
        return versionId;
    }

    private async _references(
        ctx: RunContext,
        index: number,
        target: WorkspacePath,
        options: ReferenceUpdateOptions
    ): Promise<boolean> {
        const outcome = await this._task(
            ctx,
            index,
            (): Promise<ReferenceUpdateOutcome> =>
                updateOutdatedReferences(ctx.client, target, options)
        );
        if (!outcome) {
            return false;
        }
        ctx.result.updatedElements += outcome.updatedElements;
        if (outcome.updatedElements > 0) {
            ctx.result.updatedWorkspaces++;
        }
        return true;
    }

    /**
     * A pull moves this workspace onto a new version of each parent — a
     * reference points at a version, so a parent's unversioned edits are only
     * pullable once there is one holding them. An update-only pull moves it
     * onto the versions those parents already have.
     */
    private async _pull(ctx: RunContext, params: PullJobParams): Promise<void> {
        const { sources, updateOnly } = params;
        let index = 0;

        if (!sources) {
            await this._references(ctx, index, params.workspace, {});
            return;
        }
        if (updateOnly) {
            await this._references(ctx, index, params.workspace, {
                onlyDocumentIds: sources.map((each) => each.documentId)
            });
            return;
        }

        // Keyed by document, which the route has already made unambiguous by
        // refusing a run naming one twice.
        const pinnedVersions: Record<string, string> = {};
        for (const source of sources) {
            const versionId = await this._version(ctx, index++, source);
            if (versionId) {
                pinnedVersions[source.documentId] = versionId;
            }
        }
        if (Object.keys(pinnedVersions).length === 0) {
            this._skip(ctx, index);
            return;
        }
        await this._references(ctx, index, params.workspace, {
            onlyDocumentIds: Object.keys(pinnedVersions),
            pinnedVersions
        });
    }

    private async _push(ctx: RunContext, params: PushJobParams): Promise<void> {
        const { workspace, updateOnly } = params;
        let index = 0;

        if (updateOnly) {
            // Onto whichever version of this document is newest, which is what
            // Onshape reports each reference out of date against.
            for (const pushStep of params.steps) {
                await this._references(ctx, index++, pushStep.workspace, {
                    onlyDocumentIds: [workspace.documentId]
                });
            }
            return;
        }

        const rootVersion = await this._version(ctx, index++, workspace);
        if (!rootVersion) {
            // Nothing for anything below to move onto.
            while (index < ctx.tasks.length) {
                this._skip(ctx, index++);
            }
            return;
        }

        // Every version this run has cut, which is what the workspaces further
        // down are moved onto. Keyed by document, which the route has already
        // made unambiguous by refusing a run that versions one twice.
        const pinnedVersions: Record<string, string> = {
            [workspace.documentId]: rootVersion
        };

        for (const pushStep of params.steps) {
            const updated = await this._references(
                ctx,
                index++,
                pushStep.workspace,
                {
                    onlyDocumentIds: Object.keys(pinnedVersions),
                    pinnedVersions
                }
            );
            if (!pushStep.createVersion) continue;

            const versionIndex = index++;
            if (!updated) {
                // A version of it now would hold the references that failed to
                // move; the documents past it keep the version they have.
                this._skip(ctx, versionIndex);
                continue;
            }
            const versionId = await this._version(
                ctx,
                versionIndex,
                pushStep.workspace
            );
            if (versionId) {
                pinnedVersions[pushStep.workspace.documentId] = versionId;
            }
        }
    }
}

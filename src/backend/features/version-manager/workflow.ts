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
    isSameWorkspace,
    nextVersionName,
    VersionJobKind,
    VersionJobState,
    VersionTaskAction,
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

interface JobParamsBase {
    /** Whose Onshape session the run borrows; see the load workflow. */
    sessionId: string;
    /** Who started it, for the record the run writes when it finishes. */
    userId: string;
    /** The workspace the run was started from, which its status is keyed by. */
    workspace: WorkspacePath;
    /** How it was aimed, which only the record it writes reads back. */
    scope: PushScopeKind | PullScopeKind;
    /** Moves references onto versions that exist, cutting none. */
    updateOnly: boolean;
    targets: VersionJobDocument[];
    /** Every document the run touches, by `workspaceKey`. */
    documentNames: Record<string, string>;
    /** Absent for a quick run, which names each version as Onshape would. */
    name?: string;
    description: string;
}

export interface PushJobParams extends JobParamsBase {
    kind: VersionJobKind.PUSH;
    /** The workspaces to update, in the order they have to run; see `pushOrder`. */
    steps: WorkspacePath[];
    /** Versions each of them too, which the ones past it need to reference. */
    recursive: boolean;
}

export interface PullJobParams extends JobParamsBase {
    kind: VersionJobKind.PULL;
    /** The parents to pull from; absent for every out-of-date reference. */
    sources?: WorkspacePath[];
}

export type VersionJobParams = PushJobParams | PullJobParams;

/** Runs one Onshape call as its own retried step of the task. */
type StepRunner = <T extends Rpc.Serializable<T>>(
    name: string,
    callback: (client: OnshapeApi) => Promise<T>
) => Promise<T>;

/** One run, shared by the steps that report on it. */
interface RunContext {
    params: VersionJobParams;
    step: WorkflowStep;
    startedAt: number;
    tasks: VersionTask[];
    result: VersionJobResult;
    status: (state: VersionJobState) => VersionJobStatus;
}

/**
 * How far before the run's own start a version it finds may have been cut, for
 * Onshape's clock running behind ours.
 */
const CLOCK_SLACK_MS = 60 * 1000;

/**
 * Runs a push or a pull: the tasks `planTasks` lays out, in order. A task that
 * fails is recorded and passed; only what needed it is skipped.
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
        // Both moved on as the steps come back, which a replay does again from
        // their saved results: a run that stops can then say what it had done.
        const result = emptyJobResult();
        const tasks = planTasks(params);
        const ctx: RunContext = {
            params,
            step,
            startedAt: event.timestamp.getTime(),
            tasks,
            result,
            status: (state) => ({
                state,
                jobId: event.instanceId,
                kind: params.kind,
                updateOnly: params.updateOnly,
                targets: params.targets,
                tasks,
                result
            })
        };

        let error: unknown;
        try {
            await this._runTasks(ctx);
        } catch (thrown) {
            error = thrown;
        }
        const final: VersionJobStatus = {
            ...ctx.status(
                error ? VersionJobState.FAILED : VersionJobState.COMPLETE
            ),
            ...(error ? { error: describeRunFailure(error) } : {})
        };
        await step.do("finish-job", () =>
            reportJob(this.env, params.workspace, {
                ...final,
                finishedAt: Date.now()
            })
        );
        await step.do("record-run", () =>
            trackVersionRun(this.env, {
                userId: params.userId,
                kind: params.kind,
                scope: params.scope,
                status: final
            }).catch((trackError: unknown) =>
                console.error("Failed to record a version run", trackError)
            )
        );
        if (error) {
            throw error;
        }
        return result;
    }

    private async _runTasks(ctx: RunContext): Promise<void> {
        // Every version this run has cut, by document, which is what the
        // references after it are moved onto. The route refuses a run that
        // would version one document twice.
        const pinned: Record<string, string> = {};

        for (const [index, task] of ctx.tasks.entries()) {
            if (task.action === VersionTaskAction.VERSION) {
                if (this._needsFailedUpdate(ctx, task)) {
                    task.state = VersionTaskState.SKIPPED;
                    continue;
                }
                const versionId = await this._version(ctx, index);
                if (versionId) {
                    pinned[task.workspace.documentId] = versionId;
                }
                continue;
            }
            const options = this._referenceOptions(ctx.params, pinned);
            if (!options) {
                task.state = VersionTaskState.SKIPPED;
                continue;
            }
            await this._references(ctx, index, options);
        }
    }

    /**
     * Whether this version would hold references that failed to move: a
     * recursive push versions a workspace only once they have.
     */
    private _needsFailedUpdate(ctx: RunContext, task: VersionTask): boolean {
        const update = ctx.tasks.find(
            (each) =>
                each.action === VersionTaskAction.REFERENCES &&
                isSameWorkspace(each.workspace, task.workspace)
        );
        return update !== undefined && update.state !== VersionTaskState.DONE;
    }

    /** Which references to move, or undefined when there is nothing to move onto. */
    private _referenceOptions(
        params: VersionJobParams,
        pinned: Record<string, string>
    ): ReferenceUpdateOptions | undefined {
        if (params.kind === VersionJobKind.PULL && !params.sources) {
            return {};
        }
        if (params.updateOnly) {
            // Onto each document's newest version, which is what Onshape
            // reports a reference out of date against.
            return {
                onlyDocumentIds:
                    params.kind === VersionJobKind.PUSH
                        ? [params.workspace.documentId]
                        : (params.sources ?? []).map((each) => each.documentId)
            };
        }
        const documentIds = Object.keys(pinned);
        return documentIds.length > 0
            ? { onlyDocumentIds: documentIds, pinnedVersions: { ...pinned } }
            : undefined;
    }

    /**
     * Runs one task: reports it started, then does its work, one retried step
     * per Onshape call. Only a failure that could go differently is retried;
     * any other leaves at once in our own words, and is recorded against the
     * task. Undefined when the task failed.
     */
    private async _task<T>(
        ctx: RunContext,
        index: number,
        work: (run: StepRunner) => Promise<T>
    ): Promise<T | undefined> {
        const task = ctx.tasks[index];
        task.state = VersionTaskState.RUNNING;
        await ctx.step.do(`report-${index}`, () =>
            reportJob(
                this.env,
                ctx.params.workspace,
                ctx.status(VersionJobState.RUNNING)
            )
        );

        const run: StepRunner = (name, callback) =>
            ctx.step.do(
                `${name}-${index}`,
                { retries: ONSHAPE_STEP_RETRIES },
                async () => {
                    try {
                        return await callback(
                            await getOnshapeApiFromSessionId(
                                this.env.KV,
                                ctx.params.sessionId
                            )
                        );
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

        try {
            const value = await work(run);
            task.state = VersionTaskState.DONE;
            return value;
        } catch (error) {
            task.state = VersionTaskState.FAILED;
            task.reason = describeRunFailure(error);
            return undefined;
        }
    }

    /**
     * A new version of the task's workspace, under the name given or the one
     * Onshape's own dialog would offer, numbered from that document's history.
     */
    private async _version(
        ctx: RunContext,
        index: number
    ): Promise<string | undefined> {
        const { workspace } = ctx.tasks[index];
        const { name, description } = ctx.params;
        const versionId = await this._task(ctx, index, async (run) => {
            // Its own step, so a retried create looks for the same name.
            const versionName =
                name ??
                (await run("name", async (client) =>
                    nextVersionName(
                        (await getVersions(client, workspace)).map(
                            (each) => each.name
                        )
                    )
                ));
            return run("version", async (client) => {
                // One an earlier attempt cut before its answer was lost.
                const cut = (await getVersions(client, workspace)).find(
                    (each) =>
                        each.name === versionName &&
                        Date.parse(each.createdAt) >=
                            ctx.startedAt - CLOCK_SLACK_MS
                );
                return (
                    cut ??
                    (await createVersion(
                        client,
                        workspace,
                        versionName,
                        description
                    ))
                ).id;
            });
        });
        if (versionId !== undefined) {
            ctx.result.createdVersions++;
        }
        return versionId;
    }

    private async _references(
        ctx: RunContext,
        index: number,
        options: ReferenceUpdateOptions
    ): Promise<void> {
        const task = ctx.tasks[index];
        const outcome = await this._task(ctx, index, (run) =>
            run("references", (client) =>
                updateOutdatedReferences(client, task.workspace, options)
            )
        );
        if (!outcome) {
            return;
        }
        task.updatedElements = outcome.updatedElements;
        ctx.result.updatedElements += outcome.updatedElements;
    }
}

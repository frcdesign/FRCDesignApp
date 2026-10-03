/**
 * Finding the run a workspace last started, and how it went.
 *
 * Not the library `job-tracker`, which is keyed by library and answers only
 * running or not: here what the run did is what the user is waiting for.
 */
import type { AppBindings } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { pushVersionJob } from "../push/notify";
import {
    VersionJobState,
    VersionTaskState,
    workspaceKey,
    type VersionJobResult,
    type VersionJobStatus,
    type VersionTask,
    type WorkspacePath
} from "./contract";
import { describeRunFailure } from "./failures";
import { isWorkflowActive } from "../../lib/workflows";

/**
 * How long a run's status outlives it. Long enough to reopen the panel and read
 * how it went, short enough that it is not what someone comes back to tomorrow.
 */
const JOB_TTL_SECONDS = 60 * 60 * 6;

/** A workspace's last run: marked running while it goes, then how it ended. */
const jobs = kvStore<VersionJobStatus>("version-job", {
    ttlSeconds: JOB_TTL_SECONDS
});

/**
 * Marks the run and tells the workspace it is going, so a second person in the
 * same document sees the spinner rather than an idle page.
 */
export async function startJob(
    env: AppBindings,
    workspace: WorkspacePath,
    jobId: string,
    run: Pick<VersionJobStatus, "kind" | "updateOnly" | "targets">
): Promise<VersionJobStatus> {
    const status: VersionJobStatus = {
        ...run,
        state: VersionJobState.RUNNING,
        jobId
    };
    await reportJob(env, workspace, status);
    return status;
}

/**
 * Keeps how the run is going or how it ended, and tells the workspace it moved
 * on. Nothing else writes the mark: a workspace runs one at a time.
 */
export async function reportJob(
    env: AppBindings,
    workspace: WorkspacePath,
    status: VersionJobStatus
): Promise<void> {
    const id = workspaceKey(workspace);
    await jobs.put(env.KV, id, status);
    await pushVersionJob(env, id);
}

/** What the run this workspace last started is doing, or did. */
export async function getJobStatus(
    env: AppBindings,
    workspace: WorkspacePath
): Promise<VersionJobStatus> {
    const stored = await jobs.get(env.KV, workspaceKey(workspace));
    if (!stored) {
        return { state: VersionJobState.NONE };
    }
    if (stored.state !== VersionJobState.RUNNING || !stored.jobId) {
        return stored;
    }
    // Asked rather than trusted: a run that died before it could report leaves
    // its mark saying it is still going.
    const live = await readWorkflowRun(env, stored.jobId);
    if (!live || live.state === VersionJobState.RUNNING) {
        return stored;
    }
    return {
        ...stored,
        ...live,
        tasks: stored.tasks?.map((task) => settleTask(task, live.error))
    };
}

/** A step of a run that ended without reporting: the one going failed, the rest never ran. */
function settleTask(task: VersionTask, reason?: string): VersionTask {
    switch (task.state) {
        case VersionTaskState.RUNNING:
            return { ...task, state: VersionTaskState.FAILED, reason };
        case VersionTaskState.PENDING:
            return { ...task, state: VersionTaskState.SKIPPED };
        default:
            return task;
    }
}

/**
 * The run as Workflows has it, or undefined when it can't say. The route
 * creates the workflow run before marking it, and Workflows keeps it longer
 * than the mark, so a failed read is transient and the mark stands.
 */
async function readWorkflowRun(
    env: AppBindings,
    jobId: string
): Promise<VersionJobStatus | undefined> {
    let status;
    try {
        const run = await env.VERSION_MANAGER_WORKFLOW.get(jobId);
        status = await run.status();
    } catch (error) {
        console.warn(`Failed to read version run ${jobId}`, error);
        return undefined;
    }

    if (isWorkflowActive(status.status)) {
        return { state: VersionJobState.RUNNING, jobId: jobId };
    }
    if (status.status === "complete") {
        return {
            state: VersionJobState.COMPLETE,
            jobId: jobId,
            result: status.output as VersionJobResult | undefined
        };
    }
    return {
        state: VersionJobState.FAILED,
        jobId: jobId,
        error: describeRunFailure(
            status.error && new Error(status.error.message)
        )
    };
}

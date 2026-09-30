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
    type WorkspacePath
} from "./contract";
import { describeRunFailure } from "./failures";

/**
 * How long a run's status outlives it. Long enough to reopen the panel and read
 * how it went, short enough that it is not what someone comes back to tomorrow.
 */
const JOB_TTL_SECONDS = 60 * 60 * 6;

/** A workspace's last run: marked running while it goes, then how it ended. */
const jobs = kvStore<VersionJobStatus>("version-job", {
    ttlSeconds: JOB_TTL_SECONDS
});

/** Instance statuses that mean the run is still live. */
const ACTIVE_STATUSES = new Set([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

/**
 * Marks the run and tells the workspace it is going, so a second person in the
 * same document sees the spinner rather than an idle page.
 */
export async function startJob(
    env: AppBindings,
    workspace: WorkspacePath,
    instanceId: string,
    run: Pick<VersionJobStatus, "kind" | "updateOnly" | "targets">
): Promise<VersionJobStatus> {
    const status: VersionJobStatus = {
        ...run,
        state: VersionJobState.RUNNING,
        jobId: instanceId
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
    const live = await readInstance(env, stored.jobId);
    if (live.state === VersionJobState.RUNNING) {
        return stored;
    }
    return {
        ...stored,
        ...live,
        tasks: stored.tasks?.map((task) => ({
            ...task,
            state:
                task.state === VersionTaskState.RUNNING
                    ? VersionTaskState.FAILED
                    : task.state === VersionTaskState.PENDING
                      ? VersionTaskState.SKIPPED
                      : task.state,
            reason:
                task.state === VersionTaskState.RUNNING
                    ? live.error
                    : task.reason
        }))
    };
}

/** The run as the platform has it, for one whose own report is not to hand. */
async function readInstance(
    env: AppBindings,
    instanceId: string
): Promise<VersionJobStatus> {
    let status;
    try {
        const instance = await env.VERSION_MANAGER_WORKFLOW.get(instanceId);
        status = await instance.status();
    } catch {
        // Aged out of the platform's retention, or never existed.
        return { state: VersionJobState.NONE };
    }

    if (ACTIVE_STATUSES.has(status.status)) {
        return { state: VersionJobState.RUNNING, jobId: instanceId };
    }
    if (status.status === "complete") {
        return {
            state: VersionJobState.COMPLETE,
            jobId: instanceId,
            result: status.output as VersionJobResult | undefined
        };
    }
    return {
        state: VersionJobState.FAILED,
        jobId: instanceId,
        error: describeRunFailure(
            status.error && new Error(status.error.message)
        )
    };
}

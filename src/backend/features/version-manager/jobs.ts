/**
 * Finding the run a workspace last started, and how it went.
 *
 * Not the library `job-tracker`: that one is keyed by library and answers only
 * running or not. Here what the run did is what the user is waiting for, so the
 * status it ended with is kept — for a panel opened after it finished, and for
 * a client that missed the push saying so.
 */
import type { AppBindings } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { pushVersionJob } from "../push/notify";
import {
    VersionJobState,
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
    await jobs.put(env.KV, workspaceKey(workspace), status);
    await pushVersionJob(env, workspaceKey(workspace), status);
    return status;
}

/**
 * Tells the workspace how the run is going or how it ended, and keeps it —
 * unless a later run has taken the workspace over, whose mark it would
 * otherwise overwrite.
 */
export async function reportJob(
    env: AppBindings,
    workspace: WorkspacePath,
    status: VersionJobStatus
): Promise<void> {
    const id = workspaceKey(workspace);
    const current = await jobs.get(env.KV, id);
    if (!current || current.jobId === status.jobId) {
        await jobs.put(env.KV, id, status);
    }
    await pushVersionJob(env, id, status);
}

/**
 * What the run is doing, or did. `jobId` is the client saying which run it is
 * watching; without one this is whatever the workspace last started.
 */
export async function getJobStatus(
    env: AppBindings,
    workspace: WorkspacePath,
    jobId?: string
): Promise<VersionJobStatus> {
    const stored = await jobs.get(env.KV, workspaceKey(workspace));
    if (jobId && stored?.jobId !== jobId) {
        // A run this workspace has since moved on from.
        return readInstance(env, jobId);
    }
    if (!stored?.jobId) {
        return { state: VersionJobState.NONE };
    }
    if (stored.state !== VersionJobState.RUNNING) {
        return stored;
    }
    // Asked rather than trusted: a run that died before it could report leaves
    // its mark saying it is still going.
    const live = await readInstance(env, stored.jobId);
    return live.state === VersionJobState.RUNNING
        ? stored
        : { ...stored, ...live };
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
        error: describeRunFailure(toError(status.error))
    };
}

/**
 * Workflows reports an error as a string on some paths and an object on others;
 * either becomes an `Error` whose message is what it said.
 */
function toError(error: unknown): Error | undefined {
    if (typeof error === "string") return new Error(error);
    if (error && typeof error === "object" && "message" in error) {
        const { message } = error;
        if (typeof message === "string") return new Error(message);
    }
    return undefined;
}

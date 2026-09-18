/**
 * Finding the run a workspace last started.
 *
 * Not the library `job-tracker`: that one is keyed by library and answers only
 * running or not. Here the run's *output* is what the user is waiting for, so
 * the instance is what gets asked, and KV holds nothing but a pointer to it for
 * a panel that was closed and reopened.
 */
import type { AppBindings } from "../../lib/context";
import {
    VersionJobState,
    type VersionJobResult,
    type VersionJobStatus,
    type WorkspacePath
} from "./contract";

/**
 * How long the pointer outlives the run. Long enough to reopen the panel and
 * read the result, short enough that a stale id is not what someone comes back
 * to tomorrow.
 */
const JOB_TTL_SECONDS = 60 * 60 * 6;

/** Instance statuses that mean the run is still live. */
const ACTIVE_STATUSES = new Set([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

function jobKey(workspace: WorkspacePath): string {
    return `version-job:${workspace.documentId}|${workspace.instanceId}`;
}

export async function rememberJob(
    env: AppBindings,
    workspace: WorkspacePath,
    instanceId: string
): Promise<void> {
    await env.KV.put(jobKey(workspace), instanceId, {
        expirationTtl: JOB_TTL_SECONDS
    });
}

/**
 * Clears the pointer at the end of a run, but only when it is still this run's:
 * a second push started while the first was finishing owns it now.
 */
export async function forgetJob(
    env: AppBindings,
    workspace: WorkspacePath,
    instanceId: string
): Promise<void> {
    const key = jobKey(workspace);
    if ((await env.KV.get(key)) === instanceId) {
        await env.KV.delete(key);
    }
}

/**
 * What the run is doing, or did. `jobId` is the client saying which run it is
 * watching; without one this falls back to whatever the workspace last started,
 * which is how a reopened panel finds a run still going.
 */
export async function getJobStatus(
    env: AppBindings,
    workspace: WorkspacePath,
    jobId?: string
): Promise<VersionJobStatus> {
    const instanceId = jobId ?? (await env.KV.get(jobKey(workspace)));
    if (!instanceId) {
        return { state: VersionJobState.NONE };
    }

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
        error: toErrorMessage(status.error)
    };
}

/**
 * Workflows reports an error as a string on some paths and an object on others,
 * so this takes whichever and leaves the wording to the client when it is
 * neither.
 */
function toErrorMessage(error: unknown): string | undefined {
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error) {
        const { message } = error;
        if (typeof message === "string") return message;
    }
    return undefined;
}

/**
 * The Quick fastener run an assembly last started, and how it went. Ephemeral,
 * so in KV.
 */
import type { AppBindings } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { type ElementPath } from "../../lib/onshape/path";
import { isWorkflowActive } from "../../lib/workflows";
import { pushFastenerJob } from "../push/notify";
import { workspaceKey } from "../version-manager/contract";
import {
    assemblyKey,
    FastenerJobState,
    FastenerTaskState,
    type FastenerJobStatus,
    type FastenerTask
} from "./contract";

/** Long enough to come back to the assembly and read how it went. */
const JOB_TTL_SECONDS = 60 * 60 * 6;

const jobs = kvStore<FastenerJobStatus>("fastener-job", {
    ttlSeconds: JOB_TTL_SECONDS
});

/** Keeps how the run is going or how it ended, and tells the assembly it moved on. */
export async function reportJob(
    env: AppBindings,
    assembly: ElementPath,
    status: FastenerJobStatus
): Promise<void> {
    const key = assemblyKey(assembly);
    await jobs.put(env.KV, key, status);
    await pushFastenerJob(env, workspaceKey(assembly), key);
}

/** What the run this assembly last started is doing, or did. */
export async function getJobStatus(
    env: AppBindings,
    assembly: ElementPath
): Promise<FastenerJobStatus> {
    const stored = await jobs.get(env.KV, assemblyKey(assembly));
    if (!stored) {
        return { state: FastenerJobState.NONE };
    }
    if (stored.state !== FastenerJobState.RUNNING || !stored.jobId) {
        return stored;
    }
    // Asked rather than trusted: a run that died before it could report leaves its mark saying it's going.
    let status;
    try {
        status = await (
            await env.QUICK_FASTENER_WORKFLOW.get(stored.jobId)
        ).status();
    } catch (error) {
        console.warn(`Failed to read fastener run ${stored.jobId}`, error);
        return stored;
    }
    if (isWorkflowActive(status.status)) {
        return stored;
    }
    return {
        ...stored,
        state: FastenerJobState.FAILED,
        error: stored.error ?? "The run stopped unexpectedly.",
        tasks: stored.tasks?.map(settleTask)
    };
}

/** A step of a run that ended without reporting: the one going failed, the rest never ran. */
function settleTask(task: FastenerTask): FastenerTask {
    switch (task.state) {
        case FastenerTaskState.RUNNING:
            return { ...task, state: FastenerTaskState.FAILED };
        case FastenerTaskState.PENDING:
            return { ...task, state: FastenerTaskState.SKIPPED };
        default:
            return task;
    }
}

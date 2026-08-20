import type { AppBindings } from "../app";
import type { LibraryId } from "../../shared/types";
import type { JobStatus } from "../../shared/api-models";

/**
 * Backstop for a job that crashes before untracking itself; must outlast the
 * longest load (reloads and large adds can run for hours).
 */
const JOB_TTL_SECONDS = 60 * 60 * 24;

/** Instance statuses that mean a job is still live. */
const ACTIVE_STATUSES = new Set([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

export type JobKind = "reload" | "add-group";

interface TrackedJob {
    id: string;
    kind: JobKind;
    /** Epoch ms the job was created. */
    startedAt: number;
}

function jobsKey(libraryId: LibraryId): string {
    return `library-jobs:${libraryId}`;
}

function workflowForKind(env: AppBindings, kind: JobKind) {
    return kind === "reload"
        ? env.LOAD_LIBRARY_WORKFLOW
        : env.ADD_GROUP_WORKFLOW;
}

/** Whether a tracked job's workflow instance is still live. */
async function isJobActive(
    env: AppBindings,
    job: TrackedJob
): Promise<boolean> {
    try {
        const instance = await workflowForKind(env, job.kind).get(job.id);
        const status = (await instance.status()).status;
        return ACTIVE_STATUSES.has(status);
    } catch {
        return false; // Instance aged out of retention or never existed.
    }
}

async function readJobs(
    env: AppBindings,
    libraryId: LibraryId
): Promise<TrackedJob[]> {
    const raw = await env.KV.get(jobsKey(libraryId));
    return raw ? (JSON.parse(raw) as TrackedJob[]) : [];
}

/** The tracked jobs whose workflow is still running. */
async function activeJobs(
    env: AppBindings,
    libraryId: LibraryId
): Promise<TrackedJob[]> {
    const jobs = await readJobs(env, libraryId);
    const live = await Promise.all(jobs.map((job) => isJobActive(env, job)));
    return jobs.filter((_, i) => live[i]);
}

/** Whether a reload is running — used to keep reloads a singleton per library. */
export async function isReloadRunning(
    env: AppBindings,
    libraryId: LibraryId
): Promise<boolean> {
    const jobs = await activeJobs(env, libraryId);
    return jobs.some((job) => job.kind === "reload");
}

/** Reports the oldest running job's age, which paces the client's polling. */
export async function getJobStatus(
    env: AppBindings,
    libraryId: LibraryId
): Promise<JobStatus> {
    const jobs = await activeJobs(env, libraryId);
    if (jobs.length === 0) {
        return { running: false };
    }
    const startedAt = Math.min(...jobs.map((job) => job.startedAt));
    return { running: true, runningForMs: Date.now() - startedAt };
}

/** Records a newly-created job, pruning any that have since finished. */
export async function trackJob(
    env: AppBindings,
    libraryId: LibraryId,
    kind: JobKind,
    instanceId: string
): Promise<void> {
    const jobs = await activeJobs(env, libraryId);
    jobs.push({ id: instanceId, kind, startedAt: Date.now() });
    await env.KV.put(jobsKey(libraryId), JSON.stringify(jobs), {
        expirationTtl: JOB_TTL_SECONDS
    });
}

/**
 * Removes a job's entry as it finishes — the workflow calls this in a final step
 * so the running-job state clears promptly instead of waiting out the TTL. Only
 * its own entry is touched, so concurrent jobs are unaffected.
 */
export async function untrackJob(
    env: AppBindings,
    libraryId: LibraryId,
    instanceId: string
): Promise<void> {
    const remaining = (await readJobs(env, libraryId)).filter(
        (job) => job.id !== instanceId
    );
    if (remaining.length === 0) {
        await env.KV.delete(jobsKey(libraryId));
    } else {
        await env.KV.put(jobsKey(libraryId), JSON.stringify(remaining), {
            expirationTtl: JOB_TTL_SECONDS
        });
    }
}

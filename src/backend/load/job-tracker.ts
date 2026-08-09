import type { AppBindings } from "../app";
import type { LibraryId } from "../../shared/types";

/** Safety net so a crashed run's entry clears; must outlast the longest reload. */
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

/** Whether any load job (reload or add-group) is running for this library. */
export async function isAnyJobRunning(
    env: AppBindings,
    libraryId: LibraryId
): Promise<boolean> {
    return (await activeJobs(env, libraryId)).length > 0;
}

/** Records a newly-created job, pruning any that have since finished. */
export async function trackJob(
    env: AppBindings,
    libraryId: LibraryId,
    kind: JobKind,
    instanceId: string
): Promise<void> {
    const jobs = await activeJobs(env, libraryId);
    jobs.push({ id: instanceId, kind });
    await env.KV.put(jobsKey(libraryId), JSON.stringify(jobs), {
        expirationTtl: JOB_TTL_SECONDS
    });
}

/**
 * One load per group at a time: two writing the same rows would interleave.
 * A load requested meanwhile replaces the running one. In D1 since concurrent
 * KV writes lose updates.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { chunkForInArray } from "../../db/chunk";
import { loadJobs } from "../../db/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushJobStatus, pushLibraryChanged } from "../push/notify";
import type { JobStatus } from "./contract";
import { flagFailedLoads, publishLibraries } from "./flag";

export interface LoadDocumentParams {
    libraryId: LibraryId;
    groupId: string;
    /** Who asked for the load, whose session it tries first; see `getOnshapeApiFromContext`. */
    sessionId?: string;
    /** Reloads insertables whose version has not changed, too. */
    forceReload: boolean;
    /** Waits for an admin to approve a new version before loading it. */
    awaitApproval?: boolean;
    /** This deployment's, which the document's webhook is delivered to. */
    origin: string;
}

/** What a held load waits for; see `approveHeldLoads`. */
export const APPROVE_EVENT = "approve-version";

/** A version nobody approves in this long loads anyway. */
export const APPROVAL_TIMEOUT = "2 days";

/** Instance statuses that mean a load is still live. */
const ACTIVE_STATUSES = new Set<InstanceStatus["status"]>([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

/** After this, a claimed row with no instance is treated as a failed start. */
const CLAIM_GRACE_MS = 60_000;

/** Workflows create at most this many instances a call. */
const CREATE_BATCH = 100;

/** Five columns a row, under D1's 100 bound parameters a statement. */
const ROWS_PER_INSERT = 15;

type LoadJob = typeof loadJobs.$inferSelect;

/** Whether a row's load is still running; one that crashed left its row behind. */
async function isAlive(env: AppBindings, job: LoadJob): Promise<boolean> {
    if (!job.instanceId) {
        return Date.now() - job.startedAt.getTime() < CLAIM_GRACE_MS;
    }
    try {
        const instance = await env.LOAD_DOCUMENT_WORKFLOW.get(job.instanceId);
        return ACTIVE_STATUSES.has((await instance.status()).status);
    } catch {
        return false; // Aged out of retention, or never created.
    }
}

async function clearDead(
    env: AppBindings,
    jobs: LoadJob[]
): Promise<LoadJob[]> {
    const alive = await Promise.all(jobs.map((job) => isAlive(env, job)));
    const dead = jobs.filter((_, i) => !alive[i]);
    const db = getDb(env.DB);
    for (const chunk of chunkForInArray(dead.map((job) => job.groupId))) {
        await db.delete(loadJobs).where(inArray(loadJobs.groupId, chunk));
    }
    if (dead.length > 0) {
        // It crashed before it could record its own failure.
        await flagFailedLoads(
            env,
            dead.map((job) => job.groupId)
        );
        await publishLibraries(
            env,
            dead.map((job) => job.libraryId)
        );
    }
    return jobs.filter((_, i) => alive[i]);
}

/**
 * Starts a load of each group. One already running is terminated and replaced,
 * since the new load reads the latest version itself.
 */
export async function requestLoads(
    env: AppBindings,
    requests: LoadDocumentParams[]
): Promise<void> {
    const db = getDb(env.DB);
    const groupIds = requests.map((request) => request.groupId);

    const existing: LoadJob[] = [];
    for (const chunk of chunkForInArray(groupIds)) {
        existing.push(
            ...(await db
                .select()
                .from(loadJobs)
                .where(inArray(loadJobs.groupId, chunk)))
        );
    }
    const running = new Map(
        (await clearDead(env, existing)).map((job) => [job.groupId, job])
    );
    await terminateLoads(env, [...running.values()]);

    const starts = requests.map((request) => ({
        id: crypto.randomUUID(),
        params: {
            ...request,
            // A forced reload isn't undone by a plain load replacing it.
            forceReload:
                request.forceReload ||
                (running.get(request.groupId)?.forceReload ?? false)
        }
    }));
    const startedAt = new Date();
    const replacing = starts.filter((start) =>
        running.has(start.params.groupId)
    );
    const fresh = starts.filter((start) => !running.has(start.params.groupId));

    const writes: BatchItem<"sqlite">[] = replacing.map((start) =>
        db
            .update(loadJobs)
            .set({
                instanceId: start.id,
                startedAt,
                forceReload: start.params.forceReload,
                awaitingApproval: false
            })
            .where(eq(loadJobs.groupId, start.params.groupId))
    );
    for (let i = 0; i < fresh.length; i += ROWS_PER_INSERT) {
        writes.push(
            db
                .insert(loadJobs)
                .values(
                    fresh.slice(i, i + ROWS_PER_INSERT).map((start) => ({
                        groupId: start.params.groupId,
                        libraryId: start.params.libraryId,
                        instanceId: start.id,
                        startedAt,
                        forceReload: start.params.forceReload
                    }))
                )
                .onConflictDoNothing()
        );
    }
    if (writes.length > 0) {
        await db.batch(
            writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
        );
    }

    // Each load stands alone, so they all start at once.
    const batches: (typeof starts)[] = [];
    for (let i = 0; i < starts.length; i += CREATE_BATCH) {
        batches.push(starts.slice(i, i + CREATE_BATCH));
    }
    await Promise.all(
        batches.map((batch) => env.LOAD_DOCUMENT_WORKFLOW.createBatch(batch))
    );

    const libraryIds = new Set(requests.map((request) => request.libraryId));
    for (const libraryId of libraryIds) {
        await pushJobStatus(
            env,
            libraryId,
            await runningStatus(env, libraryId)
        );
    }
}

/** Stops loads about to be replaced. One that has just finished can't be, which is fine. */
async function terminateLoads(
    env: AppBindings,
    jobs: LoadJob[]
): Promise<void> {
    await Promise.all(
        jobs.map(async (job) => {
            if (!job.instanceId) return;
            try {
                const instance = await env.LOAD_DOCUMENT_WORKFLOW.get(
                    job.instanceId
                );
                await instance.terminate();
            } catch (error) {
                console.warn(
                    `Failed to stop the load of ${job.groupId}`,
                    error
                );
            }
        })
    );
}

/**
 * Whether it failed or not. Publishes what it wrote, then releases the group,
 * unless a newer load has replaced this one.
 */
export async function finishLoad(
    env: AppBindings,
    params: LoadDocumentParams,
    instanceId: string,
    changed: boolean
): Promise<void> {
    const db = getDb(env.DB);
    // Before the bump, which makes /search-db immutable for a year.
    if (changed) {
        await rebuildSearchDb(env.BLOB, db, params.libraryId);
        await bumpLibraryVersion(db, params.libraryId);
        await pushLibraryChanged(env, params.libraryId);
    }
    await db
        .delete(loadJobs)
        .where(
            and(
                eq(loadJobs.groupId, params.groupId),
                eq(loadJobs.instanceId, instanceId)
            )
        );
    await pushJobStatus(
        env,
        params.libraryId,
        await runningStatus(env, params.libraryId)
    );
}

/** The groups loading, from the rows alone, trusting each to be live. */
async function runningStatus(
    env: AppBindings,
    libraryId: LibraryId
): Promise<JobStatus> {
    const rows = await getDb(env.DB)
        .select({
            groupId: loadJobs.groupId,
            awaitingApproval: loadJobs.awaitingApproval
        })
        .from(loadJobs)
        .where(eq(loadJobs.libraryId, libraryId));
    return {
        loadingGroupIds: rows
            .filter((row) => !row.awaitingApproval)
            .map((row) => row.groupId),
        awaitingApprovalGroupIds: rows
            .filter((row) => row.awaitingApproval)
            .map((row) => row.groupId)
    };
}

/** From inside the load, as it starts and stops waiting for approval. */
export async function setAwaitingApproval(
    env: AppBindings,
    params: LoadDocumentParams,
    awaitingApproval: boolean
): Promise<void> {
    await getDb(env.DB)
        .update(loadJobs)
        .set({ awaitingApproval })
        .where(eq(loadJobs.groupId, params.groupId));
    await pushJobStatus(
        env,
        params.libraryId,
        await runningStatus(env, params.libraryId)
    );
}

/** An event sent before a load reaches its wait is kept for it. */
async function releaseHeldLoads(
    env: AppBindings,
    jobs: LoadJob[]
): Promise<void> {
    await Promise.all(
        jobs.map(async (job) => {
            if (!job.instanceId) return;
            try {
                const instance = await env.LOAD_DOCUMENT_WORKFLOW.get(
                    job.instanceId
                );
                await instance.sendEvent({ type: APPROVE_EVENT, payload: {} });
            } catch (error) {
                console.error(
                    `Failed to approve the load of ${job.groupId}`,
                    error
                );
            }
        })
    );
    const db = getDb(env.DB);
    for (const chunk of chunkForInArray(jobs.map((job) => job.groupId))) {
        await db
            .update(loadJobs)
            .set({ awaitingApproval: false })
            .where(inArray(loadJobs.groupId, chunk));
    }
}

/** Lets every load the library is holding through. Returns how many there were. */
export async function approveHeldLoads(
    env: AppBindings,
    libraryId: LibraryId
): Promise<number> {
    const held = await getDb(env.DB)
        .select()
        .from(loadJobs)
        .where(
            and(
                eq(loadJobs.libraryId, libraryId),
                eq(loadJobs.awaitingApproval, true)
            )
        );
    await releaseHeldLoads(env, held);
    await pushJobStatus(env, libraryId, await runningStatus(env, libraryId));
    return held.length;
}

/** Also clears rows left by crashed loads. Pushes keep the client current after this. */
export async function getJobStatus(
    env: AppBindings,
    libraryId: LibraryId
): Promise<JobStatus> {
    const jobs = await getDb(env.DB)
        .select()
        .from(loadJobs)
        .where(eq(loadJobs.libraryId, libraryId));
    await clearDead(env, jobs);
    return runningStatus(env, libraryId);
}

/**
 * Document loads, one per group at a time. A load asked for while one runs is
 * marked on the running one's row instead, and that load starts it as it
 * finishes: two loads writing one group's rows at once would interleave, and
 * the second may well be the one with the newer version to load.
 *
 * Rows in D1 rather than a list in KV, since loads start and finish
 * concurrently — a full reload starts one per document — and KV loses writes
 * that race.
 */
import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { chunkForInArray } from "../../db/chunk";
import { loadJobs } from "../../db/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushJobStatus, pushLibraryChanged } from "../live/notify";
import type { JobStatus } from "./contract";

export interface LoadDocumentParams {
    libraryId: LibraryId;
    groupId: string;
    /** Whose Onshape session the load calls Onshape with. */
    sessionId: string;
    /** Reloads insertables whose version has not changed, too. */
    forceReload: boolean;
    /** This deployment's, which the document's webhook is delivered to. */
    origin: string;
}

/** Instance statuses that mean a load is still live. */
const ACTIVE_STATUSES = new Set<InstanceStatus["status"]>([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

/**
 * How long a claimed row may go without an instance before it is taken for
 * one whose start failed partway.
 */
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

/** Clears the rows of loads that are no longer running. */
async function clearDead(
    env: AppBindings,
    jobs: LoadJob[]
): Promise<LoadJob[]> {
    const alive = await Promise.all(jobs.map((job) => isAlive(env, job)));
    const dead = jobs.filter((_, i) => !alive[i]).map((job) => job.groupId);
    const db = getDb(env.DB);
    for (const groupIds of chunkForInArray(dead)) {
        await db.delete(loadJobs).where(inArray(loadJobs.groupId, groupIds));
    }
    return jobs.filter((_, i) => alive[i]);
}

/** Starts a load of each group, or marks it to run again after its current one. */
export async function requestLoads(
    env: AppBindings,
    requests: LoadDocumentParams[]
): Promise<void> {
    const db = getDb(env.DB);
    const byGroup = new Map(
        requests.map((request) => [request.groupId, request])
    );
    const groupIds = [...byGroup.keys()];

    const existing: LoadJob[] = [];
    for (const chunk of chunkForInArray(groupIds)) {
        existing.push(
            ...(await db
                .select()
                .from(loadJobs)
                .where(inArray(loadJobs.groupId, chunk)))
        );
    }
    const running = new Set(
        (await clearDead(env, existing)).map((job) => job.groupId)
    );

    // Running already: its load starts this one as it finishes.
    const queued = requests.filter((request) => running.has(request.groupId));
    const writes: BatchItem<"sqlite">[] = queued.map((request) =>
        db
            .update(loadJobs)
            .set({
                rerun: true,
                // Once asked for, a forced reload is not downgraded.
                ...(request.forceReload ? { rerunForce: true } : {})
            })
            .where(eq(loadJobs.groupId, request.groupId))
    );

    const toStart = requests
        .filter((request) => !running.has(request.groupId))
        .map((params) => ({ id: crypto.randomUUID(), params }));
    const startedAt = new Date();
    for (let i = 0; i < toStart.length; i += ROWS_PER_INSERT) {
        writes.push(
            db
                .insert(loadJobs)
                .values(
                    toStart.slice(i, i + ROWS_PER_INSERT).map((start) => ({
                        groupId: start.params.groupId,
                        libraryId: start.params.libraryId,
                        instanceId: start.id,
                        startedAt
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

    // Started together: each load stands alone, down to its library's search
    // index, so nothing waits on any other.
    const batches: (typeof toStart)[] = [];
    for (let i = 0; i < toStart.length; i += CREATE_BATCH) {
        batches.push(toStart.slice(i, i + CREATE_BATCH));
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

/** What a finished load does next: nothing, or its group's queued load. */
type FinishOutcome = "done" | "rerun";

/**
 * Called by a load as it finishes, whether it failed or not. Publishes what it
 * wrote, when it wrote anything, and starts the load queued behind it or lets
 * the group go.
 */
export async function finishLoad(
    env: AppBindings,
    params: LoadDocumentParams,
    changed: boolean
): Promise<FinishOutcome> {
    const db = getDb(env.DB);
    // Rebuilt before the bump: the new version makes /search-db immutable, so
    // a client fetching in between would pin the stale index for a year.
    if (changed) {
        await rebuildSearchDb(env.BLOB, db, params.libraryId);
        await bumpLibraryVersion(db, params.libraryId);
        await pushLibraryChanged(env, params.libraryId);
    }

    const job = await db
        .select()
        .from(loadJobs)
        .where(eq(loadJobs.groupId, params.groupId))
        .get();

    let outcome: FinishOutcome = "done";
    if (job?.rerun) {
        const instanceId = crypto.randomUUID();
        await db
            .update(loadJobs)
            .set({
                instanceId,
                startedAt: new Date(),
                rerun: false,
                rerunForce: false
            })
            .where(eq(loadJobs.groupId, params.groupId));
        await env.LOAD_DOCUMENT_WORKFLOW.create({
            id: instanceId,
            params: { ...params, forceReload: job.rerunForce }
        });
        outcome = "rerun";
    } else {
        await db.delete(loadJobs).where(eq(loadJobs.groupId, params.groupId));
    }

    await pushJobStatus(
        env,
        params.libraryId,
        await runningStatus(env, params.libraryId)
    );
    return outcome;
}

/** The groups loading, from the rows alone, trusting each to be live. */
async function runningStatus(
    env: AppBindings,
    libraryId: LibraryId
): Promise<JobStatus> {
    const rows = await getDb(env.DB)
        .select({ groupId: loadJobs.groupId })
        .from(loadJobs)
        .where(eq(loadJobs.libraryId, libraryId));
    return { loadingGroupIds: rows.map((row) => row.groupId) };
}

/**
 * The groups loading, clearing any left behind by a load that crashed first.
 * For the client's first look; pushes keep it current after that.
 */
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

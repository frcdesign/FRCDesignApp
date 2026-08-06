import { desc, eq } from "drizzle-orm";
import type { AppBindings } from "./app";
import { getDb, type Db } from "./db";
import { libraryJobs } from "../shared/schema";
import type { LibraryId } from "../shared/types";
import type {
    GroupResult,
    LibraryJob,
    LibraryJobStatus,
    LibraryJobType
} from "../shared/library-job-models";

/** A full library-job row, including the internal Cloudflare instance id. */
type LibraryJobRow = typeof libraryJobs.$inferSelect;

/** Drops internal-only columns to produce the client-facing DTO. */
export function toLibraryJob(row: LibraryJobRow): LibraryJob {
    return {
        id: row.id,
        type: row.type,
        libraryId: row.libraryId,
        status: row.status,
        label: row.label,
        triggeredBy: row.triggeredBy,
        result: row.result,
        error: row.error,
        createdAt: row.createdAt,
        finishedAt: row.finishedAt
    };
}

interface CreateLibraryJobArgs {
    id: string;
    instanceId: string;
    type: LibraryJobType;
    libraryId: LibraryId;
    label: string;
    triggeredBy: string | null;
}

/** Inserts a new `running` library-job row. */
export async function createLibraryJob(
    db: Db,
    args: CreateLibraryJobArgs
): Promise<void> {
    await db.insert(libraryJobs).values({
        id: args.id,
        instanceId: args.instanceId,
        type: args.type,
        libraryId: args.libraryId,
        status: "running",
        label: args.label,
        triggeredBy: args.triggeredBy
    });
}

interface FinishLibraryJobArgs {
    status: LibraryJobStatus;
    result: GroupResult | GroupResult[] | null;
    error: string | null;
}

/** Marks a library job finished with its outcome. */
export async function finishLibraryJob(
    db: Db,
    id: string,
    args: FinishLibraryJobArgs
): Promise<void> {
    await db
        .update(libraryJobs)
        .set({
            status: args.status,
            result: args.result,
            error: args.error,
            finishedAt: Date.now()
        })
        .where(eq(libraryJobs.id, id));
}

/** Recent library jobs for a library, newest first. */
export async function listLibraryJobs(
    db: Db,
    libraryId: LibraryId,
    limit = 50
): Promise<LibraryJobRow[]> {
    return db
        .select()
        .from(libraryJobs)
        .where(eq(libraryJobs.libraryId, libraryId))
        .orderBy(desc(libraryJobs.createdAt))
        .limit(limit)
        .all();
}

function workflowForType(env: AppBindings, type: LibraryJobType) {
    return type === "load-library"
        ? env.LOAD_LIBRARY_WORKFLOW
        : env.ADD_GROUP_WORKFLOW;
}

/**
 * Safety net for jobs still marked `running` in D1 whose workflow died before
 * writing its own completion. Queries the live Cloudflare instance status and,
 * when it reports a terminal state, corrects the row. Returns the (possibly
 * updated) jobs so the caller can return the reconciled view.
 */
export async function reconcileRunningLibraryJobs(
    env: AppBindings,
    jobs: LibraryJobRow[]
): Promise<LibraryJobRow[]> {
    const db = getDb(env.DB);
    return Promise.all(
        jobs.map(async (job) => {
            if (job.status !== "running") return job;

            let corrected: { status: LibraryJobStatus; error: string | null };
            try {
                const instance = await workflowForType(env, job.type).get(
                    job.instanceId
                );
                const { status, error } = await instance.status();
                if (status === "complete") {
                    // The run finished but never recorded its own result.
                    corrected = { status: "complete", error: null };
                } else if (status === "errored" || status === "terminated") {
                    corrected = {
                        status: "errored",
                        error: error?.message ?? "Workflow " + status
                    };
                } else {
                    // queued/running/paused/waiting — still in flight.
                    return job;
                }
            } catch {
                // The instance is unknown or its status has expired; stop it
                // from spinning as `running` forever.
                corrected = {
                    status: "errored",
                    error: "Workflow status unavailable"
                };
            }

            await db
                .update(libraryJobs)
                .set({
                    status: corrected.status,
                    error: corrected.error,
                    finishedAt: Date.now()
                })
                .where(eq(libraryJobs.id, job.id));
            return {
                ...job,
                status: corrected.status,
                error: corrected.error,
                finishedAt: Date.now()
            };
        })
    );
}

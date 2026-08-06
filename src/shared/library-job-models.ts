/**
 * Shared models for library jobs — background workflow runs against a library.
 * Kept in `shared` so both the backend workflows/routes and the frontend can
 * import them without crossing the backend/shared boundary.
 */

/** Which workflow a library job ran. */
export type LibraryJobType = "load-library" | "add-group";

/**
 * The app-level status of a library job.
 * - `running`  — created, not yet finished.
 * - `complete` — finished with no group failures.
 * - `partial`  — finished, but some groups failed while others succeeded.
 * - `errored`  — finished with every group failed, or the run itself threw.
 */
export type LibraryJobStatus = "running" | "complete" | "partial" | "errored";

/** True once a library job has stopped running. */
export function isFinishedStatus(status: LibraryJobStatus): boolean {
    return status !== "running";
}

/**
 * Whether an entity's (group or insertable) most recent load completed. Partial
 * outcomes (e.g. a group loaded but some of its insertables failed) are conveyed
 * by `buildIssues`, not here.
 */
export type LoadStatus = "success" | "failed";

/**
 * A single library-job record, as returned to the client. Per-group detail lives
 * on the groups/insertables themselves (their `lastLoaded*` + `buildIssues`), so
 * the run record only carries the overall outcome.
 */
export interface LibraryJob {
    id: string;
    type: LibraryJobType;
    libraryId: string;
    status: LibraryJobStatus;
    label: string;
    triggeredBy: string | null;
    error: string | null;
    createdAt: number;
    finishedAt: number | null;
}

export interface LibraryJobsData {
    libraryJobs: LibraryJob[];
}

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
 * The outcome of loading a single group within a workflow run. Failures carry
 * their error message (and the group name, when known) so the UI can show which
 * group failed and why.
 */
export type GroupResult =
    | { groupId: string; name?: string; status: "skipped" }
    | { groupId: string; name?: string; status: "failed"; error: string }
    | {
          groupId: string;
          name?: string;
          status: "created" | "reloaded";
          loadedElements: number;
          deletedElements: number;
          failedElements: number;
      };

/** A single library-job record, as returned to the client. */
export interface LibraryJob {
    id: string;
    type: LibraryJobType;
    libraryId: string;
    status: LibraryJobStatus;
    label: string;
    triggeredBy: string | null;
    result: GroupResult | GroupResult[] | null;
    error: string | null;
    createdAt: number;
    finishedAt: number | null;
}

export interface LibraryJobsData {
    libraryJobs: LibraryJob[];
}

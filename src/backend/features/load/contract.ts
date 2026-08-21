/**
 * Whether a library-load job is running, and how long it has been going.
 * Milliseconds since the oldest running job started paces the client's polling.
 */
export type JobStatus =
    | { running: false }
    | { running: true; runningForMs: number };

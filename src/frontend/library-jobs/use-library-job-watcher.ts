import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { queryClient } from "../query-client";
import {
    contextDataQueryKey,
    libraryQueryMatchKey,
    useLibraryJobsQuery
} from "../queries";
import {
    showErrorToast,
    showSuccessToast,
    showWarningToast
} from "../common/notifications";
import { type LibraryJob } from "../../shared/library-job-models";

/** Number of groups that failed within a finished job's result. */
function failureCount(job: LibraryJob): number {
    const results = Array.isArray(job.result)
        ? job.result
        : job.result
          ? [job.result]
          : [];
    return results.filter((r) => r.status === "failed").length;
}

/** Refresh the library data a finished job may have changed, then toast it. */
async function handleFinishedJob(
    job: LibraryJob,
    invalidateRouter: () => void
): Promise<void> {
    // Same refresh the trigger buttons do on settle, but now driven by the
    // job actually finishing rather than a fixed delay.
    await queryClient.refetchQueries({ queryKey: contextDataQueryKey() });
    await queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
    invalidateRouter();

    if (job.status === "complete") {
        showSuccessToast(`${job.label} finished.`);
    } else if (job.status === "partial") {
        const failed = failureCount(job);
        showWarningToast(
            `${job.label} finished — ${failed} ${
                failed === 1 ? "group" : "groups"
            } failed. See Library Jobs for details.`
        );
    } else {
        showErrorToast(`${job.label} failed. See Library Jobs for details.`);
    }
}

/**
 * Watches the current library's jobs and, when one transitions from running to
 * finished, refreshes the library view and shows an outcome toast. Mount once
 * in the app layout. A ref of the previously-running ids lets it detect the
 * transition; starting from `null` avoids toasting jobs that finished before
 * the app loaded.
 */
export function useLibraryJobWatcher(): void {
    const router = useRouter();
    const { data } = useLibraryJobsQuery();
    const prevRunningIds = useRef<Set<string> | null>(null);

    useEffect(() => {
        if (!data) return;

        const jobsById = new Map(data.libraryJobs.map((job) => [job.id, job]));
        const running = new Set(
            data.libraryJobs
                .filter((job) => job.status === "running")
                .map((job) => job.id)
        );

        const prev = prevRunningIds.current;
        if (prev) {
            for (const id of prev) {
                if (running.has(id)) continue;
                const job = jobsById.get(id);
                if (job) {
                    void handleFinishedJob(job, () => void router.invalidate());
                }
            }
        }
        prevRunningIds.current = running;
    }, [data, router]);
}

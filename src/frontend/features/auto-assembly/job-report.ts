/** How a run is going or went, in the few words the callout, the toast and the details share. */
import {
    AssemblyJobOutcome,
    AssemblyTaskAction,
    AssemblyTaskState,
    type AssemblyJobStatus
} from "@backend/features/auto-assembly/contract";
import { m } from "../../paraglide/messages";
import { Status } from "../../lib/status";

export const OUTCOME_STATUS: Record<AssemblyJobOutcome, Status> = {
    [AssemblyJobOutcome.SUCCESS]: Status.SUCCESS,
    [AssemblyJobOutcome.PARTIAL]: Status.WARNING,
    [AssemblyJobOutcome.FAILED]: Status.ERROR
};

function taskRunning(action: AssemblyTaskAction): string {
    switch (action) {
        case AssemblyTaskAction.INDEX:
            return m.autoAssemblyTaskIndexRunning();
        case AssemblyTaskAction.REMOVE:
            return m.autoAssemblyTaskDeleteRunning();
        case AssemblyTaskAction.INSERT:
            return m.autoAssemblyTaskInsertRunning();
        case AssemblyTaskAction.FASTEN:
            return m.autoAssemblyTaskFastenRunning();
    }
}

/** "Indexing holes...", or whichever step is going. */
export function runningHeadline(status: AssemblyJobStatus): string {
    const task = status.tasks?.find(
        (each) => each.state === AssemblyTaskState.RUNNING
    );
    return task ? taskRunning(task.action) : m.autoAssemblyInserting();
}

/** "Inserted 12 parts", "Updated 3 screws", or how it stopped short. */
export function jobHeadline(
    status: AssemblyJobStatus,
    outcome: AssemblyJobOutcome
): string {
    const inserted = status.result?.inserted ?? 0;
    const updated = status.result?.replaced ?? 0;
    switch (outcome) {
        case AssemblyJobOutcome.SUCCESS:
            return updated > 0
                ? m.autoAssemblyUpdated({ count: updated })
                : m.autoAssemblyInserted({ count: inserted });
        case AssemblyJobOutcome.PARTIAL:
            return updated > 0
                ? m.autoAssemblyUpdatedWithProblems({ count: updated })
                : m.autoAssemblyInsertedWithProblems({ count: inserted });
        case AssemblyJobOutcome.FAILED:
            return m.autoAssemblyFailed();
    }
}

/** How a run is going or went, in the few words the callout, the toast and the details share. */
import {
    AssemblyJobOutcome,
    AssemblyRunKind,
    AssemblyTaskAction,
    AssemblyTaskState,
    type AssemblyJobStatus,
    type AssemblyTask
} from "@backend/features/auto-assembly/contract";
import { m } from "../../paraglide/messages";
import { Status } from "../../lib/status";

export const OUTCOME_STATUS: Record<AssemblyJobOutcome, Status> = {
    [AssemblyJobOutcome.SUCCESS]: Status.SUCCESS,
    [AssemblyJobOutcome.PARTIAL]: Status.WARNING,
    [AssemblyJobOutcome.FAILED]: Status.ERROR
};

/** Whether a run places declared parts rather than fastening holes. */
export function isDeclaredRun(status: AssemblyJobStatus): boolean {
    return status.kind === AssemblyRunKind.DECLARED_PARTS;
}

function taskRunning(
    action: AssemblyTaskAction,
    status: AssemblyJobStatus
): string {
    switch (action) {
        case AssemblyTaskAction.INDEX:
            return isDeclaredRun(status)
                ? m.autoAssemblyTaskFindRunning()
                : m.autoAssemblyTaskIndexRunning();
        case AssemblyTaskAction.REMOVE:
            return m.autoAssemblyTaskDeleteRunning();
        case AssemblyTaskAction.INSERT:
            return m.autoAssemblyTaskInsertRunning();
        case AssemblyTaskAction.FASTEN:
            return m.autoAssemblyTaskFastenRunning();
    }
}

function runningTask(status: AssemblyJobStatus): AssemblyTask | undefined {
    return status.tasks?.find(
        (each) => each.state === AssemblyTaskState.RUNNING
    );
}

/** "Indexing holes...", or whichever step is going. */
export function runningHeadline(status: AssemblyJobStatus): string {
    const task = runningTask(status);
    return task ? taskRunning(task.action, status) : m.autoAssemblyInserting();
}

/** "Indexing holes. You can keep working.", or whichever step is going. */
export function runningCallout(status: AssemblyJobStatus): string {
    switch (runningTask(status)?.action) {
        case AssemblyTaskAction.INDEX:
            return isDeclaredRun(status)
                ? m.autoAssemblyFindingCallout()
                : m.autoAssemblyIndexingCallout();
        case AssemblyTaskAction.REMOVE:
            return m.autoAssemblyDeletingCallout();
        case AssemblyTaskAction.FASTEN:
            return m.autoAssemblyFasteningCallout();
        case AssemblyTaskAction.INSERT:
        case undefined:
            return m.autoAssemblyInsertingCallout();
    }
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
            if (isDeclaredRun(status) && inserted === 0) {
                return m.autoAssemblyNoDeclaredParts();
            }
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

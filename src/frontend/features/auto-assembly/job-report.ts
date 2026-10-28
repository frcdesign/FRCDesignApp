/** How a run is going or went, in the few words the callout, the toast and the details share. */
import {
    AssemblyJobOutcome,
    AssemblyTaskAction,
    AssemblyTaskState,
    type AssemblyJobStatus
} from "@backend/features/auto-assembly/contract";
import { plural } from "../../lib/plural";
import { Status } from "../../lib/status";

export const OUTCOME_STATUS: Record<AssemblyJobOutcome, Status> = {
    [AssemblyJobOutcome.SUCCESS]: Status.SUCCESS,
    [AssemblyJobOutcome.PARTIAL]: Status.WARNING,
    [AssemblyJobOutcome.FAILED]: Status.ERROR
};

export const TASK_LABEL: Record<AssemblyTaskAction, string> = {
    [AssemblyTaskAction.INDEX]: "Index holes",
    [AssemblyTaskAction.INSERT]: "Insert parts",
    [AssemblyTaskAction.FASTEN]: "Fasten parts"
};

const TASK_RUNNING: Record<AssemblyTaskAction, string> = {
    [AssemblyTaskAction.INDEX]: "Indexing holes",
    [AssemblyTaskAction.INSERT]: "Inserting parts",
    [AssemblyTaskAction.FASTEN]: "Fastening parts"
};

/** "Indexing holes", or whichever step is going. */
export function runningHeadline(status: AssemblyJobStatus): string {
    const task = status.tasks?.find(
        (each) => each.state === AssemblyTaskState.RUNNING
    );
    return task ? TASK_RUNNING[task.action] : "Inserting fasteners";
}

/** "Inserted 12 parts", or how it stopped short. */
export function jobHeadline(
    status: AssemblyJobStatus,
    outcome: AssemblyJobOutcome
): string {
    const parts = `Inserted ${plural(status.result?.inserted ?? 0, "part")}`;
    switch (outcome) {
        case AssemblyJobOutcome.SUCCESS:
            return parts;
        case AssemblyJobOutcome.PARTIAL:
            return `${parts} with problems`;
        case AssemblyJobOutcome.FAILED:
            return "Couldn't insert fasteners";
    }
}

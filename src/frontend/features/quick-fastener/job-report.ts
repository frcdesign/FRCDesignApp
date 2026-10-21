/** How a run is going or went, in the few words the callout, the toast and the details share. */
import {
    FastenerJobOutcome,
    FastenerTaskAction,
    FastenerTaskState,
    type FastenerJobStatus
} from "@backend/features/quick-fastener/contract";
import { plural } from "../../lib/plural";
import { Status } from "../../lib/status";

export const OUTCOME_STATUS: Record<FastenerJobOutcome, Status> = {
    [FastenerJobOutcome.SUCCESS]: Status.SUCCESS,
    [FastenerJobOutcome.PARTIAL]: Status.WARNING,
    [FastenerJobOutcome.FAILED]: Status.ERROR
};

export const TASK_LABEL: Record<FastenerTaskAction, string> = {
    [FastenerTaskAction.INDEX]: "Index holes",
    [FastenerTaskAction.INSERT]: "Insert parts",
    [FastenerTaskAction.FASTEN]: "Fasten parts"
};

const TASK_RUNNING: Record<FastenerTaskAction, string> = {
    [FastenerTaskAction.INDEX]: "Indexing holes",
    [FastenerTaskAction.INSERT]: "Inserting parts",
    [FastenerTaskAction.FASTEN]: "Fastening parts"
};

/** "Indexing holes", or whichever step is going. */
export function runningHeadline(status: FastenerJobStatus): string {
    const task = status.tasks?.find(
        (each) => each.state === FastenerTaskState.RUNNING
    );
    return task ? TASK_RUNNING[task.action] : "Inserting fasteners";
}

/** "Inserted 12 parts", or how it stopped short. */
export function jobHeadline(
    status: FastenerJobStatus,
    outcome: FastenerJobOutcome
): string {
    const inserted = status.result?.inserted ?? 0;
    switch (outcome) {
        case FastenerJobOutcome.SUCCESS:
            return `Inserted ${plural(inserted, "part")}`;
        case FastenerJobOutcome.PARTIAL:
            return `Inserted ${plural(inserted, "part")}, with problems`;
        case FastenerJobOutcome.FAILED:
            return "Couldn't insert fasteners";
    }
}

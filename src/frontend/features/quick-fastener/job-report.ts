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
    [FastenerTaskAction.FASTEN]: "Fasten parts",
    [FastenerTaskAction.REPLICATE]: "Replicate parts"
};

const TASK_RUNNING: Record<FastenerTaskAction, string> = {
    [FastenerTaskAction.INDEX]: "Indexing holes",
    [FastenerTaskAction.INSERT]: "Inserting parts",
    [FastenerTaskAction.FASTEN]: "Fastening parts",
    [FastenerTaskAction.REPLICATE]: "Replicating parts"
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
    const replicated = status.result?.replicated ?? 0;
    const parts =
        replicated > 0
            ? `Inserted ${plural(inserted, "part")}, replicated onto ${plural(replicated, "hole")}`
            : `Inserted ${plural(inserted, "part")}`;
    switch (outcome) {
        case FastenerJobOutcome.SUCCESS:
            return parts;
        case FastenerJobOutcome.PARTIAL:
            return `${parts}, with problems`;
        case FastenerJobOutcome.FAILED:
            return "Couldn't insert fasteners";
    }
}
